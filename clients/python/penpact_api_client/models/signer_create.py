from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.auth_method import AuthMethod
from ..types import UNSET, Unset
from typing import Union






T = TypeVar("T", bound="SignerCreate")



@_attrs_define
class SignerCreate:
    """ 
        Attributes:
            name (str):
            email (str):
            routing_order (Union[Unset, int]):  Default: 1.
            auth_method (Union[Unset, AuthMethod]):
            access_code (Union[Unset, str]): Required when authMethod is access_code.
     """

    name: str
    email: str
    routing_order: Union[Unset, int] = 1
    auth_method: Union[Unset, AuthMethod] = UNSET
    access_code: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        email = self.email

        routing_order = self.routing_order

        auth_method: Union[Unset, str] = UNSET
        if not isinstance(self.auth_method, Unset):
            auth_method = self.auth_method.value


        access_code = self.access_code


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "email": email,
        })
        if routing_order is not UNSET:
            field_dict["routingOrder"] = routing_order
        if auth_method is not UNSET:
            field_dict["authMethod"] = auth_method
        if access_code is not UNSET:
            field_dict["accessCode"] = access_code

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        email = d.pop("email")

        routing_order = d.pop("routingOrder", UNSET)

        _auth_method = d.pop("authMethod", UNSET)
        auth_method: Union[Unset, AuthMethod]
        if isinstance(_auth_method,  Unset):
            auth_method = UNSET
        else:
            auth_method = AuthMethod(_auth_method)




        access_code = d.pop("accessCode", UNSET)

        signer_create = cls(
            name=name,
            email=email,
            routing_order=routing_order,
            auth_method=auth_method,
            access_code=access_code,
        )


        signer_create.additional_properties = d
        return signer_create

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
