from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast, Union
from typing import Union
from uuid import UUID






T = TypeVar("T", bound="SigningSessionDocumentsItem")



@_attrs_define
class SigningSessionDocumentsItem:
    """ 
        Attributes:
            id (Union[Unset, UUID]):
            document_url (Union[Unset, str]):
            page_count (Union[None, Unset, int]):
     """

    id: Union[Unset, UUID] = UNSET
    document_url: Union[Unset, str] = UNSET
    page_count: Union[None, Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id: Union[Unset, str] = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)

        document_url = self.document_url

        page_count: Union[None, Unset, int]
        if isinstance(self.page_count, Unset):
            page_count = UNSET
        else:
            page_count = self.page_count


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if id is not UNSET:
            field_dict["id"] = id
        if document_url is not UNSET:
            field_dict["documentUrl"] = document_url
        if page_count is not UNSET:
            field_dict["pageCount"] = page_count

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _id = d.pop("id", UNSET)
        id: Union[Unset, UUID]
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        document_url = d.pop("documentUrl", UNSET)

        def _parse_page_count(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        page_count = _parse_page_count(d.pop("pageCount", UNSET))


        signing_session_documents_item = cls(
            id=id,
            document_url=document_url,
            page_count=page_count,
        )


        signing_session_documents_item.additional_properties = d
        return signing_session_documents_item

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
