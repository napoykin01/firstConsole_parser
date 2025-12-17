import re
import json
import asyncio
import logging

from typing import List, Dict
import xml.etree.ElementTree as ET # noqa
from concurrent.futures import ThreadPoolExecutor

from schemas.schemas import YandexSourceResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class YandexSearchService:
    def __init__(self, yandex_sdk, user_agent: str, max_results: int):
        self.sdk = yandex_sdk
        self.user_agent = user_agent
        self.max_results = max_results
        self.search_api = self.sdk.search_api.web(
            search_type="ru",
            user_agent=self.user_agent,
        )
        self.executor = ThreadPoolExecutor(max_workers=3)

    @staticmethod
    def parse_offer_info(offer_info_text: str) -> Dict:
        try:
            json_match = re.search(r'\{.*}', offer_info_text)
            if json_match:
                return json.loads(json_match.group())

        except (json.JSONDecodeError, AttributeError) as error:
            logger.warning(f"Ошибка парсинга offer_info: {error}")
        return {}

    @staticmethod
    def extract_price_from_text(text: str) -> float | None:
        if not text:
            return None

        price_patterns = [
            r'(\d+(?:[.,]\d+)?)\s*[₽руб]',
            r'цена.*?(\d+(?:[\s,.]\d+)*)',
            r'стоимость.*?(\d+(?:[\s,.]\d+)*)',
            r'(\d+(?:[\s,.]\d+)*)\s*(?:руб|₽)'
        ]

        for pattern in price_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    price_str = str(match).replace(' ', '').replace(',', '.')
                    price_str = re.sub(r'[^\d.]', '', price_str)

                    if price_str:
                        return float(price_str)

                except (ValueError, TypeError):
                    continue
        return None

    def extract_legal_price(self, passages: List[str]) -> float | None:
        legal_keywords = ['юрлиц', 'юридических', 'организаций', 'опт', 'оптом', 'юридическим лицам']

        for passage in passages:
            if any(keyword in passage.lower() for keyword in legal_keywords):
                price = self.extract_price_from_text(passage)
                if price:
                    return price
        return None

    def parse_xml_result(self, xml_content: str) -> List[YandexSourceResponse]:
        results = []

        try:
            root = ET.fromstring(xml_content)
            namespaces = {'ns': 'http://www.yandex.ru/xsd'} if '{http://www.yandex.ru/xsd}' in xml_content else {}

            if namespaces:
                groups = root.findall('.//ns:grouping/ns:group', namespaces)
            else:
                groups = root.findall('.//grouping/group')

            logger.info(f"Найдено {len(groups)} групп в XML")

            for i, group in enumerate(groups[:self.max_results]):
                try:
                    categ = group.find('categ')
                    source_name = categ.get('name') if categ is not None else "Неизвестно"

                    doc = group.find('doc')

                    if doc is None:
                        continue

                    url_elem = doc.find('url')
                    url = url_elem.text if url_elem is not None else ""

                    title_elem = doc.find('title')
                    title = title_elem.text if title_elem is not None else ""

                    passages = []
                    passages_elem = doc.find('passages')
                    if passages_elem is not None:
                        for passage in passages_elem.findall('passage'):
                            if passage.text and passage.text.strip():
                                passages.append(passage.text.strip())

                    properties = doc.find('properties')
                    offer_info = {}

                    if properties is not None:
                        offer_info_elem = properties.find('offer_info')
                        if offer_info_elem is not None and offer_info_elem.text:
                            offer_info = self.parse_offer_info(offer_info_elem.text)

                    retail_price = None
                    before_discount_price = None

                    if offer_info:
                        if 'price' in offer_info and 'value' in offer_info['price']:
                            retail_price = float(offer_info['price']['value'])

                        if 'discount' in offer_info and 'oldprice' in offer_info['discount']:
                            before_discount_price = float(offer_info['discount']['oldprice'])

                    if retail_price is None:
                        title_text = title if title is not None else ""
                        passages_text = passages if passages is not None else []

                        all_text = title_text + " " + " ".join(passages_text)
                        retail_price = self.extract_price_from_text(all_text)

                    legal_entities_price = self.extract_legal_price(passages)

                    if retail_price is not None and url:
                        result = YandexSourceResponse(
                            id=i + 1,
                            retail_price=retail_price,
                            legal_entities_price=legal_entities_price,
                            before_discount_price=before_discount_price,
                            url=url,
                            source_name=source_name
                        ) # noqa

                        results.append(result)

                        if len(results) >= self.max_results:
                            break

                except Exception as error:
                    logger.error(f"Ошибка при обработке группы {i}: {error}")
                    continue

        except ET.ParseError as e:
            logger.error(f"Ошибка парсинга XML: {e}")

        return results

    def search_single_page(self, query: str, page: int = 0) -> List[YandexSourceResponse]:
        try:
            logger.info(f"Поиск: '{query}', страница {page}")

            operation = self.search_api.run_deferred(
                f"{query} цена",
                format='xml',
                page=page
            )

            search_result = operation.wait(poll_interval=1)

            if search_result:
                xml_content = search_result.decode('utf-8')
                results = self.parse_xml_result(xml_content)
                logger.info(f"Найдено {len(results)} результатов на странице {page}")
                return results
            else:
                logger.warning(f"Пустой результат для запроса '{query}' на странице {page}")
                return []

        except Exception as e:
            logger.error(f"Ошибка при поиске '{query}' на странице {page}: {e}")
            return []

    def search(self, query: str, max_pages: int = 2) -> List[YandexSourceResponse]:
        all_results = []
        seen_urls = set()

        for page in range(max_pages):
            results = self.search_single_page(query, page)

            for result in results:
                if result.url not in seen_urls:
                    seen_urls.add(result.url)
                    all_results.append(result)

                    if len(all_results) >= self.max_results:
                        break

            if len(all_results) >= self.max_results:
                break

        if len(all_results) < self.max_results:
            logger.warning(f"Для запроса '{query}' "
                           f"найдено только {len(all_results)} результатов из {self.max_results}")

        return all_results[:self.max_results]

    def search_multiple(self, queries: List[str]) -> Dict[str, List[YandexSourceResponse]]:
        results = {}

        for query in queries:
            try:
                query_results = self.search(query)
                results[query] = query_results
                logger.info(f"Для запроса '{query}' найдено {len(query_results)} результатов")
            except Exception as e:
                logger.error(f"Ошибка при поиске '{query}': {e}")
                results[query] = []

        return results

    async def search_async(self, query: str) -> List[YandexSourceResponse]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor,
            lambda: self.search(query)
        )

    def close(self):
        self.executor.shutdown(wait=True)