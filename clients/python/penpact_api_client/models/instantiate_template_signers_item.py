from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="InstantiateTemplateSignersItem")



@_attrs_define
class InstantiateTemplateSignersItem:
    """ 
        Attributes:
            role_id (UUID):
            name (str):
            email (str):
     """

    role_id: UUID
    name: str
    email: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        role_id = str(self.role_id)

        name = self.name

        email = self.email


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "roleId": role_id,
            "name": name,
            "email": email,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role_id = UUID(d.pop("roleId"))




        name = d.pop("name")

        email = d.pop("email")

        instantiate_template_signers_item = cls(
            role_id=role_id,
            name=name,
            email=email,
        )


        instantiate_template_signers_item.additional_properties = d
        return instantiate_template_signers_item

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
