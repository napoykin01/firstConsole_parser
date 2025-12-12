import re
import time
import tldextract
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Set

from database import get_db
from models.models import Product, YandexSource
from schemas.schemas import YandexSourceResponse, ProductResponse

router = APIRouter()

MAX_PRICE_CANDIDATES_ON_PAGE = 3
MAX_PER_PRODUCT = 10
MIN_REAL_PRICE = 400
PRICE_RE = re.compile(r"(\d[\d\s]*[.,]?\d*)\s*(?:₽|руб\.?|р\.?)\b", re.I)

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

SKIP_DOMAINS = {"yandex.ru", "yandex.by", "yandex.kz", "yandex.ua",
                "lamoda", "citilink", "dns-shop", "e-katalog", "price",
                "nadavi", "onliner", "tiu", "prom", "all-tools",
}

FAST_DOMAINS = {"ozon.ru", "wildberries.ru", "wildberries.by", "wildberries.kz",
                "market.yandex.ru", "market.yandex.by", "market.yandex.kz", "market.yandex.ua"}

SPLIT_KEYWORDS = re.compile(
    r"×\s*\d+\s*плат|в рассрочку|частями|платеж|оплат.*в.*раз|split.*payment|курьер|доставк|почт|самовывоз|экономите|скидка|бесплатно|стоимость доставки", re.I
)

def _is_seller_domain(url: str) -> bool:
    ext = tldextract.extract(url)
    domain_key = f"{ext.domain}.{ext.suffix}"
    return not any(skip in domain_key for skip in SKIP_DOMAINS)

def _extract_prices_from_text(text: str) -> List[float]:
    prices = []
    for m in PRICE_RE.finditer(text):
        try:
            v = float(m.group(1).replace(" ", "").replace(",", "."))
            if 50 <= v <= 5_000_000:
                prices.append(v)
        except ValueError:
            continue
    return sorted(prices, reverse=True)

def _fetch_real_price(page, url: str, timeout: int = 5_000) -> float | None:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    except PWTimeout:
        return None

    full_text = page.inner_text("body", timeout=1_000)
    candidates = _extract_prices_from_text(full_text)

    if candidates:
        return candidates[0]

    selectors = [
        "[data-auto='mainPrice']", ".price", ".current-price", ".product-price",
        ".offer-price", ".b-price", ".price-block", ".p-price", ".cost",
        ".final-price", ".detail-price", ".item-price"
    ]
    for sel in selectors:
        try:
            txt = page.inner_text(sel, timeout=2_000)
            cand = _extract_prices_from_text(txt)
            if cand:
                return cand[0]
        except PWTimeout:
            continue
    return None

def _extract_price(text: str) -> float | None:
    if not text:
        return None

    for match in PRICE_RE.finditer(text):
        start, end = match.span()
        fragment = text[max(0, start - 50): end + 50]

        if SPLIT_KEYWORDS.search(fragment):
            continue

        try:
            v = float(match.group(1).replace(" ", "").replace(",", "."))
            if v < MIN_REAL_PRICE:
                continue
            if v <= 5_000_000:
                return v
        except ValueError:
            continue
    return None


def parse_yandex_search_playwright(part_number: str) -> List[Dict]:
    results: List[Dict] = []
    seen: Set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="ru-RU")

        search_page = context.new_page()
        search_url = f"https://yandex.ru/search/?text={part_number}+цена"

        try:
            search_page.goto(search_url, wait_until="domcontentloaded", timeout=15_000)
            search_page.wait_for_selector(".serp-item", timeout=10_000)
        except PWTimeout:
            browser.close()
            return []

        for aria in ["Закрыть", "✕", "×", "Close"]:
            try:
                search_page.locator(f"button[aria-label='{aria}']").click(timeout=2_000)
                break
            except:
                continue

        hrefs = search_page.evaluate("""
            () => Array.from(document.querySelectorAll('.serp-item a[href*="http"]'))
                       .map(a => a.href)
                       .filter(h => h && !h.includes('yandex.ru/showcaptcha'))
        """)

        hrefs_snippets = search_page.evaluate("""
                    () => Array.from(document.querySelectorAll('.serp-item'))
                        .map(item => {
                            const a = item.querySelector('a[href*="http"]');
                            return a ? {href: a.href, txt: item.innerText} : null;
                        })
                        .filter(Boolean)
                """)

        for rec in hrefs_snippets:
            href = rec["href"]
            if len(results) >= MAX_PER_PRODUCT or href in seen:
                continue
            seen.add(href)
            domain = f"{tldextract.extract(href).domain}.{tldextract.extract(href).suffix}".lower()

            if domain in FAST_DOMAINS:
                price = _extract_price(rec["txt"])
                if price:
                    results.append({"price": price, "url": href, "source_name": domain})
                continue

            try:
                site_page = context.new_page()

                try:
                    site_page.goto(href, wait_until="domcontentloaded", timeout=12_000)
                except Exception as e:
                    if "net::ERR_" in str(e) or "Timeout" in str(e):
                        site_page.close()
                        continue
                    raise

                txt = site_page.locator("body").inner_text(timeout=3_000)
                price = _extract_price(txt)
                site_page.close()

                if price:
                    results.append({"price": price, "url": href, "source_name": domain})

            except PWTimeout:
                pass

            time.sleep(0.3)

        browser.close()
    return results


@router.post("/parse_yandex/{category_id}",
             summary="Спарсить цены из Яндекса по товарам категории")
def parse_yandex_from_category(
        category_id: int,
        db: Session = Depends(get_db)
):
    products = db.query(Product).filter(Product.category_id == category_id).all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found in this category")

    product_ids_in_cat = [p.id for p in products]

    existing_sources = db.query(YandexSource).filter(
        YandexSource.product_id.in_(product_ids_in_cat)
    ).all()

    existing_sources_map = {}

    for src in existing_sources:
        key = f"{src.product_id}|{src.url}"
        existing_sources_map[key] = src

    total_created = 0
    total_updated = 0
    total_skipped = 0

    for product in products:
        if not product.part_number:
            continue

        sources = parse_yandex_search_playwright(product.part_number)

        for src in sources:
            url = src["url"]
            key = f"{product.id}|{url}"

            if key in existing_sources_map:
                existing_source = existing_sources_map[key]
                if existing_source.price != src["price"]:
                    existing_source.price = src["price"]
                    existing_source.source_name = src.get("source_name", existing_source.source_name)
                    total_updated += 1
                else:
                    total_skipped += 1
            else:
                yandex_source = YandexSource(
                    product_id=product.id,
                    price=src["price"],
                    url=url,
                    source_name=src["source_name"]
                )
                db.add(yandex_source)
                total_created += 1

        time.sleep(0.5)

    db.commit()

    return {
        "message": f"Parsed Yandex sources for {len(products)} products in category {category_id}",
        "statistics": {
            "created": total_created,
            "updated": total_updated,
            "skipped": total_skipped,
            "total_processed": total_created + total_updated + total_skipped
        }
    }

@router.get("/yandex_sources/{product_id}", summary="Получить источники из Яндекса для товара")
def get_yandex_sources(
    product_id: int,
    db: Session = Depends(get_db)
) -> List[YandexSourceResponse]:
    sources = db.query(YandexSource).filter(YandexSource.product_id == product_id).all()
    return [YandexSourceResponse.model_validate(s, from_attributes=True) for s in sources]

@router.post("/parse_and_return/{category_id}",
             summary="Спарсить Яндекс и сразу вернуть обновлённые товары категории")
def parse_and_return_products(
        category_id: int,
        db: Session = Depends(get_db)
) -> List[ProductResponse]:
    parse_yandex_from_category(category_id, db)

    products = db.query(Product).filter(Product.category_id == category_id).all()

    return [ProductResponse.model_validate(p, from_attributes=True) for p in products]