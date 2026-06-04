from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.envelope import Envelope





T = TypeVar("T", bound="WebhookEventData")



@_attrs_define
class WebhookEventData:
    """ 
        Attributes:
            envelope (Envelope):
     """

    envelope: 'Envelope'
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.envelope import Envelope
        envelope = self.envelope.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "envelope": envelope,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.envelope import Envelope
        d = dict(src_dict)
        envelope = Envelope.from_dict(d.pop("envelope"))




        webhook_event_data = cls(
            envelope=envelope,
        )


        webhook_event_data.additional_properties = d
        return webhook_event_data

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
