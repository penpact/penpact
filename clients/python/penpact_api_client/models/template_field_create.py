from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.field_type import FieldType
from ..types import UNSET, Unset
from typing import cast
from typing import Union
from uuid import UUID






T = TypeVar("T", bound="TemplateFieldCreate")



@_attrs_define
class TemplateFieldCreate:
    """ 
        Attributes:
            type_ (FieldType):
            role_id (UUID):
            page (int):
            x (float):
            y (float):
            width (float):
            height (float):
            required (Union[Unset, bool]):  Default: True.
            options (Union[Unset, list[str]]):
     """

    type_: FieldType
    role_id: UUID
    page: int
    x: float
    y: float
    width: float
    height: float
    required: Union[Unset, bool] = True
    options: Union[Unset, list[str]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        role_id = str(self.role_id)

        page = self.page

        x = self.x

        y = self.y

        width = self.width

        height = self.height

        required = self.required

        options: Union[Unset, list[str]] = UNSET
        if not isinstance(self.options, Unset):
            options = self.options




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "roleId": role_id,
            "page": page,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        })
        if required is not UNSET:
            field_dict["required"] = required
        if options is not UNSET:
            field_dict["options"] = options

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = FieldType(d.pop("type"))




        role_id = UUID(d.pop("roleId"))




        page = d.pop("page")

        x = d.pop("x")

        y = d.pop("y")

        width = d.pop("width")

        height = d.pop("height")

        required = d.pop("required", UNSET)

        options = cast(list[str], d.pop("options", UNSET))


        template_field_create = cls(
            type_=type_,
            role_id=role_id,
            page=page,
            x=x,
            y=y,
            width=width,
            height=height,
            required=required,
            options=options,
        )


        template_field_create.additional_properties = d
        return template_field_create

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
