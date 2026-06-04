from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from typing import Union
import datetime

if TYPE_CHECKING:
  from ..models.instantiate_template_signers_item import InstantiateTemplateSignersItem





T = TypeVar("T", bound="InstantiateTemplate")



@_attrs_define
class InstantiateTemplate:
    """ 
        Attributes:
            signers (list['InstantiateTemplateSignersItem']):
            document_name (Union[Unset, str]):
            expires_at (Union[Unset, datetime.datetime]):
     """

    signers: list['InstantiateTemplateSignersItem']
    document_name: Union[Unset, str] = UNSET
    expires_at: Union[Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.instantiate_template_signers_item import InstantiateTemplateSignersItem
        signers = []
        for signers_item_data in self.signers:
            signers_item = signers_item_data.to_dict()
            signers.append(signers_item)



        document_name = self.document_name

        expires_at: Union[Unset, str] = UNSET
        if not isinstance(self.expires_at, Unset):
            expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "signers": signers,
        })
        if document_name is not UNSET:
            field_dict["documentName"] = document_name
        if expires_at is not UNSET:
            field_dict["expiresAt"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.instantiate_template_signers_item import InstantiateTemplateSignersItem
        d = dict(src_dict)
        signers = []
        _signers = d.pop("signers")
        for signers_item_data in (_signers):
            signers_item = InstantiateTemplateSignersItem.from_dict(signers_item_data)



            signers.append(signers_item)


        document_name = d.pop("documentName", UNSET)

        _expires_at = d.pop("expiresAt", UNSET)
        expires_at: Union[Unset, datetime.datetime]
        if isinstance(_expires_at,  Unset):
            expires_at = UNSET
        else:
            expires_at = isoparse(_expires_at)




        instantiate_template = cls(
            signers=signers,
            document_name=document_name,
            expires_at=expires_at,
        )


        instantiate_template.additional_properties = d
        return instantiate_template

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
