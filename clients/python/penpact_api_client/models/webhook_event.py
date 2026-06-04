from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.webhook_event_type import WebhookEventType
from dateutil.parser import isoparse
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.webhook_event_data import WebhookEventData





T = TypeVar("T", bound="WebhookEvent")



@_attrs_define
class WebhookEvent:
    """ 
        Attributes:
            id (str):
            type_ (WebhookEventType):
            created_at (datetime.datetime):
            data (WebhookEventData):
     """

    id: str
    type_: WebhookEventType
    created_at: datetime.datetime
    data: 'WebhookEventData'
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.webhook_event_data import WebhookEventData
        id = self.id

        type_ = self.type_.value

        created_at = self.created_at.isoformat()

        data = self.data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "type": type_,
            "createdAt": created_at,
            "data": data,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.webhook_event_data import WebhookEventData
        d = dict(src_dict)
        id = d.pop("id")

        type_ = WebhookEventType(d.pop("type"))




        created_at = isoparse(d.pop("createdAt"))




        data = WebhookEventData.from_dict(d.pop("data"))




        webhook_event = cls(
            id=id,
            type_=type_,
            created_at=created_at,
            data=data,
        )


        webhook_event.additional_properties = d
        return webhook_event

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
