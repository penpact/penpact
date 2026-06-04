from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.signer_status import SignerStatus
from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from typing import cast, Union
from typing import Union
from uuid import UUID
import datetime






T = TypeVar("T", bound="Signer")



@_attrs_define
class Signer:
    """ 
        Attributes:
            id (UUID):
            name (str):
            email (str):
            status (SignerStatus):
            routing_order (int):
            signed_at (Union[None, Unset, datetime.datetime]):
     """

    id: UUID
    name: str
    email: str
    status: SignerStatus
    routing_order: int
    signed_at: Union[None, Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        email = self.email

        status = self.status.value

        routing_order = self.routing_order

        signed_at: Union[None, Unset, str]
        if isinstance(self.signed_at, Unset):
            signed_at = UNSET
        elif isinstance(self.signed_at, datetime.datetime):
            signed_at = self.signed_at.isoformat()
        else:
            signed_at = self.signed_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "email": email,
            "status": status,
            "routingOrder": routing_order,
        })
        if signed_at is not UNSET:
            field_dict["signedAt"] = signed_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        email = d.pop("email")

        status = SignerStatus(d.pop("status"))




        routing_order = d.pop("routingOrder")

        def _parse_signed_at(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                signed_at_type_0 = isoparse(data)



                return signed_at_type_0
            except: # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        signed_at = _parse_signed_at(d.pop("signedAt", UNSET))


        signer = cls(
            id=id,
            name=name,
            email=email,
            status=status,
            routing_order=routing_order,
            signed_at=signed_at,
        )


        signer.additional_properties = d
        return signer

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
