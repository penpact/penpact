from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.bulk_send_result_errors_item import BulkSendResultErrorsItem
  from ..models.bulk_send_result_envelopes_item import BulkSendResultEnvelopesItem





T = TypeVar("T", bound="BulkSendResult")



@_attrs_define
class BulkSendResult:
    """ 
        Attributes:
            sent (int):
            failed (int):
            envelopes (list['BulkSendResultEnvelopesItem']):
            errors (list['BulkSendResultErrorsItem']):
     """

    sent: int
    failed: int
    envelopes: list['BulkSendResultEnvelopesItem']
    errors: list['BulkSendResultErrorsItem']
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.bulk_send_result_errors_item import BulkSendResultErrorsItem
        from ..models.bulk_send_result_envelopes_item import BulkSendResultEnvelopesItem
        sent = self.sent

        failed = self.failed

        envelopes = []
        for envelopes_item_data in self.envelopes:
            envelopes_item = envelopes_item_data.to_dict()
            envelopes.append(envelopes_item)



        errors = []
        for errors_item_data in self.errors:
            errors_item = errors_item_data.to_dict()
            errors.append(errors_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "sent": sent,
            "failed": failed,
            "envelopes": envelopes,
            "errors": errors,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.bulk_send_result_errors_item import BulkSendResultErrorsItem
        from ..models.bulk_send_result_envelopes_item import BulkSendResultEnvelopesItem
        d = dict(src_dict)
        sent = d.pop("sent")

        failed = d.pop("failed")

        envelopes = []
        _envelopes = d.pop("envelopes")
        for envelopes_item_data in (_envelopes):
            envelopes_item = BulkSendResultEnvelopesItem.from_dict(envelopes_item_data)



            envelopes.append(envelopes_item)


        errors = []
        _errors = d.pop("errors")
        for errors_item_data in (_errors):
            errors_item = BulkSendResultErrorsItem.from_dict(errors_item_data)



            errors.append(errors_item)


        bulk_send_result = cls(
            sent=sent,
            failed=failed,
            envelopes=envelopes,
            errors=errors,
        )


        bulk_send_result.additional_properties = d
        return bulk_send_result

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
