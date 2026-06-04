from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.template_create_roles_item import TemplateCreateRolesItem





T = TypeVar("T", bound="TemplateCreate")



@_attrs_define
class TemplateCreate:
    """ 
        Attributes:
            name (str):
            document_name (str):
            roles (list['TemplateCreateRolesItem']):
     """

    name: str
    document_name: str
    roles: list['TemplateCreateRolesItem']
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_create_roles_item import TemplateCreateRolesItem
        name = self.name

        document_name = self.document_name

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.to_dict()
            roles.append(roles_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "documentName": document_name,
            "roles": roles,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_create_roles_item import TemplateCreateRolesItem
        d = dict(src_dict)
        name = d.pop("name")

        document_name = d.pop("documentName")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = TemplateCreateRolesItem.from_dict(roles_item_data)



            roles.append(roles_item)


        template_create = cls(
            name=name,
            document_name=document_name,
            roles=roles,
        )


        template_create.additional_properties = d
        return template_create

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
