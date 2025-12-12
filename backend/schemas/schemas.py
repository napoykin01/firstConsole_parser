from typing import List
from pydantic import BaseModel, ConfigDict


class ProductResponse(BaseModel):
    id: int
    netlab_id: int
    part_number: str | None
    name: str
    netlab_price: float | None

    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    leaf: bool
    children: List["CategoryResponse"] = []
    products: List[ProductResponse] = []

    model_config = ConfigDict(from_attributes=True)

CategoryResponse.model_rebuild()

class CatalogResponse(BaseModel):
    id: int
    name: str
    categories: List[CategoryResponse] = []

    class Config:
        from_attributes = True