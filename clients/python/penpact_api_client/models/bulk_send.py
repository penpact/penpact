from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.bulk_send_recipients_item import BulkSendRecipientsItem





T = TypeVar("T", bound="BulkSend")



@_attrs_define
class BulkSend:
    """ 
        Attributes:
            recipients (list['BulkSendRecipientsItem']):
     """

    recipients: list['BulkSendRecipientsItem']
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.bulk_send_recipients_item import BulkSendRecipientsItem
        recipients = []
        for recipients_item_data in self.recipients:
            recipients_item = recipients_item_data.to_dict()
            recipients.append(recipients_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "recipients": recipients,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bulk_send_recipients_item import BulkSendRecipientsItem
        d = dict(src_dict)
        recipients = []
        _recipients = d.pop("recipients")
        for recipients_item_data in (_recipients):
            recipients_item = BulkSendRecipientsItem.from_dict(recipients_item_data)



            recipients.append(recipients_item)


        bulk_send = cls(
            recipients=recipients,
        )


        bulk_send.additional_properties = d
        return bulk_send

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
