from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from typing import cast, Union
from typing import Union
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.template_role import TemplateRole
  from ..models.template_field import TemplateField





T = TypeVar("T", bound="Template")



@_attrs_define
class Template:
    """ 
        Attributes:
            id (UUID):
            name (str):
            document_name (str):
            roles (list['TemplateRole']):
            fields (list['TemplateField']):
            created_at (datetime.datetime):
            storage_key (Union[None, Unset, str]):
            page_count (Union[None, Unset, int]):
     """

    id: UUID
    name: str
    document_name: str
    roles: list['TemplateRole']
    fields: list['TemplateField']
    created_at: datetime.datetime
    storage_key: Union[None, Unset, str] = UNSET
    page_count: Union[None, Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_role import TemplateRole
        from ..models.template_field import TemplateField
        id = str(self.id)

        name = self.name

        document_name = self.document_name

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.to_dict()
            roles.append(roles_item)



        fields = []
        for fields_item_data in self.fields:
            fields_item = fields_item_data.to_dict()
            fields.append(fields_item)



        created_at = self.created_at.isoformat()

        storage_key: Union[None, Unset, str]
        if isinstance(self.storage_key, Unset):
            storage_key = UNSET
        else:
            storage_key = self.storage_key

        page_count: Union[None, Unset, int]
        if isinstance(self.page_count, Unset):
            page_count = UNSET
        else:
            page_count = self.page_count


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "documentName": document_name,
            "roles": roles,
            "fields": fields,
            "createdAt": created_at,
        })
        if storage_key is not UNSET:
            field_dict["storageKey"] = storage_key
        if page_count is not UNSET:
            field_dict["pageCount"] = page_count

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_role import TemplateRole
        from ..models.template_field import TemplateField
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        document_name = d.pop("documentName")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = TemplateRole.from_dict(roles_item_data)



            roles.append(roles_item)


        fields = []
        _fields = d.pop("fields")
        for fields_item_data in (_fields):
            fields_item = TemplateField.from_dict(fields_item_data)



            fields.append(fields_item)


        created_at = isoparse(d.pop("createdAt"))




        def _parse_storage_key(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        storage_key = _parse_storage_key(d.pop("storageKey", UNSET))


        def _parse_page_count(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        page_count = _parse_page_count(d.pop("pageCount", UNSET))


        template = cls(
            id=id,
            name=name,
            document_name=document_name,
            roles=roles,
            fields=fields,
            created_at=created_at,
            storage_key=storage_key,
            page_count=page_count,
        )


        template.additional_properties = d
        return template

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
