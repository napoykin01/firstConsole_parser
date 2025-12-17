from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship, backref
from database import Base

class Catalog(Base):
    __tablename__ = "catalogs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    categories = relationship("Category", back_populates="catalog")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    catalog_id = Column(Integer, ForeignKey("catalogs.id"))
    leaf = Column(Boolean, default=False)
    products = relationship("Product", back_populates="category")
    catalog = relationship("Catalog", back_populates="categories")
    children = relationship("Category", backref=backref("parent", remote_side=[id]))

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    netlab_id = Column(Integer, unique=True, nullable=False, index=True)
    availableKurskaya = Column(Float, nullable=False, default=0.0)
    availableTransit = Column(Float, nullable=False, default=0.0)
    availableKaluzhskaya = Column(Float, nullable=False, default=0.0)
    availableLobnenskaya = Column(Float, nullable=False, default=0.0)
    guarantee = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    isDiscontinued = Column(Boolean, nullable=False, default=False)
    isDeleted = Column(Boolean, nullable=False, default=False)
    priceCategoryN = Column(Float, nullable=True)
    priceCategoryF = Column(Float, nullable=True)
    priceCategoryE = Column(Float, nullable=True)
    priceCategoryD = Column(Float, nullable=True)
    priceCategoryC = Column(Float, nullable=True)
    priceCategoryB = Column(Float, nullable=True)
    priceCategoryA = Column(Float, nullable=True)
    rrc = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    tax = Column(String, nullable=True)
    part_number = Column(String, index=True)
    name = Column(String, nullable=False)
    traceable_good = Column(Integer, nullable=True)
    netlab_price = Column(Float, nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))

    yandex_sources = relationship("YandexSource",
                                  back_populates="product",
                                  cascade="all, delete-orphan")

    category = relationship("Category", back_populates="products")

class YandexSource(Base):
    __tablename__ = "yandex_source"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    retail_price = Column(Float, nullable=False, default=0.0)
    legal_entities_price = Column(Float, nullable=False, default=0.0)
    before_discount_price = Column(Float, nullable=False, default=0.0)
    url = Column(String, nullable=False)
    source_name = Column(String, nullable=True)

    product = relationship("Product", back_populates="yandex_sources")