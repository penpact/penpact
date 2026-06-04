from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Union
from uuid import UUID






T = TypeVar("T", bound="BulkSendResultEnvelopesItem")



@_attrs_define
class BulkSendResultEnvelopesItem:
    """ 
        Attributes:
            email (Union[Unset, str]):
            envelope_id (Union[Unset, UUID]):
     """

    email: Union[Unset, str] = UNSET
    envelope_id: Union[Unset, UUID] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email = self.email

        envelope_id: Union[Unset, str] = UNSET
        if not isinstance(self.envelope_id, Unset):
            envelope_id = str(self.envelope_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if email is not UNSET:
            field_dict["email"] = email
        if envelope_id is not UNSET:
            field_dict["envelopeId"] = envelope_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email", UNSET)

        _envelope_id = d.pop("envelopeId", UNSET)
        envelope_id: Union[Unset, UUID]
        if isinstance(_envelope_id,  Unset):
            envelope_id = UNSET
        else:
            envelope_id = UUID(_envelope_id)




        bulk_send_result_envelopes_item = cls(
            email=email,
            envelope_id=envelope_id,
        )


        bulk_send_result_envelopes_item.additional_properties = d
        return bulk_send_result_envelopes_item

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
