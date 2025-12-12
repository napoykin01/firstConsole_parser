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

    children = relationship("Category", backref=backref("parent", remote_side=[id]))
    catalog = relationship("Catalog", back_populates="categories")
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    netlab_id = Column(Integer, unique=True, nullable=False)
    part_number = Column(String, index=True)
    name = Column(String, nullable=False)
    netlab_price = Column(Float)
    category_id = Column(Integer, ForeignKey("categories.id"))

    additional_info = Column(JSON)

    category = relationship("Category", back_populates="products")