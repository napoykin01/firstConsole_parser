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
    netlab_id = Column(Integer, unique=True, nullable=False)
    part_number = Column(String, index=True)
    name = Column(String, nullable=False)
    netlab_price = Column(Float)
    category_id = Column(Integer, ForeignKey("categories.id"))

    additional_info = Column(JSON)

    yandex_sources = relationship("YandexSource",
                                  back_populates="product",
                                  cascade="all, delete-orphan")
    category = relationship("Category", back_populates="products")

class YandexSource(Base):
    __tablename__ = "yandex_sources"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price = Column(Float, nullable=False)
    url = Column(String, nullable=False)
    source_name = Column(String)

    product = relationship("Product", back_populates="yandex_sources")