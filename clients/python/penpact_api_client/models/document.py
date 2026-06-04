from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast, Union
from typing import Union
from uuid import UUID






T = TypeVar("T", bound="Document")



@_attrs_define
class Document:
    """ 
        Attributes:
            id (UUID):
            content_hash (str): SHA-256 hex of the bytes.
            mime_type (str):
            is_final (bool):
            byte_size (Union[None, Unset, int]):
            position (Union[Unset, int]): 0-based order within the envelope.
            page_count (Union[None, Unset, int]):
     """

    id: UUID
    content_hash: str
    mime_type: str
    is_final: bool
    byte_size: Union[None, Unset, int] = UNSET
    position: Union[Unset, int] = UNSET
    page_count: Union[None, Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        content_hash = self.content_hash

        mime_type = self.mime_type

        is_final = self.is_final

        byte_size: Union[None, Unset, int]
        if isinstance(self.byte_size, Unset):
            byte_size = UNSET
        else:
            byte_size = self.byte_size

        position = self.position

        page_count: Union[None, Unset, int]
        if isinstance(self.page_count, Unset):
            page_count = UNSET
        else:
            page_count = self.page_count


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "contentHash": content_hash,
            "mimeType": mime_type,
            "isFinal": is_final,
        })
        if byte_size is not UNSET:
            field_dict["byteSize"] = byte_size
        if position is not UNSET:
            field_dict["position"] = position
        if page_count is not UNSET:
            field_dict["pageCount"] = page_count

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        content_hash = d.pop("contentHash")

        mime_type = d.pop("mimeType")

        is_final = d.pop("isFinal")

        def _parse_byte_size(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        byte_size = _parse_byte_size(d.pop("byteSize", UNSET))


        position = d.pop("position", UNSET)

        def _parse_page_count(data: object) -> Union[None, Unset, int]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, int], data)

        page_count = _parse_page_count(d.pop("pageCount", UNSET))


        document = cls(
            id=id,
            content_hash=content_hash,
            mime_type=mime_type,
            is_final=is_final,
            byte_size=byte_size,
            position=position,
            page_count=page_count,
        )


        document.additional_properties = d
        return document

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
