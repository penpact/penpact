from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.signature_type import SignatureType
from typing import cast

if TYPE_CHECKING:
  from ..models.complete_signing_body_fields_item import CompleteSigningBodyFieldsItem





T = TypeVar("T", bound="CompleteSigningBody")



@_attrs_define
class CompleteSigningBody:
    """ 
        Attributes:
            signature_type (SignatureType):
            fields (list['CompleteSigningBodyFieldsItem']):
     """

    signature_type: SignatureType
    fields: list['CompleteSigningBodyFieldsItem']
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.complete_signing_body_fields_item import CompleteSigningBodyFieldsItem
        signature_type = self.signature_type.value

        fields = []
        for fields_item_data in self.fields:
            fields_item = fields_item_data.to_dict()
            fields.append(fields_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "signatureType": signature_type,
            "fields": fields,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.complete_signing_body_fields_item import CompleteSigningBodyFieldsItem
        d = dict(src_dict)
        signature_type = SignatureType(d.pop("signatureType"))




        fields = []
        _fields = d.pop("fields")
        for fields_item_data in (_fields):
            fields_item = CompleteSigningBodyFieldsItem.from_dict(fields_item_data)



            fields.append(fields_item)


        complete_signing_body = cls(
            signature_type=signature_type,
            fields=fields,
        )


        complete_signing_body.additional_properties = d
        return complete_signing_body

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
