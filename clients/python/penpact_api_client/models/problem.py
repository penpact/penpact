from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from typing import Union

if TYPE_CHECKING:
  from ..models.problem_errors_item import ProblemErrorsItem





T = TypeVar("T", bound="Problem")



@_attrs_define
class Problem:
    """ 
        Attributes:
            type_ (str):  Example: https://penpact.dev/errors/validation-error.
            title (str):  Example: Validation Error.
            status (int):  Example: 422.
            detail (Union[Unset, str]):  Example: `signers` must contain at least one signer..
            instance (Union[Unset, str]):  Example: /v1/envelopes.
            errors (Union[Unset, list['ProblemErrorsItem']]):
     """

    type_: str
    title: str
    status: int
    detail: Union[Unset, str] = UNSET
    instance: Union[Unset, str] = UNSET
    errors: Union[Unset, list['ProblemErrorsItem']] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.problem_errors_item import ProblemErrorsItem
        type_ = self.type_

        title = self.title

        status = self.status

        detail = self.detail

        instance = self.instance

        errors: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.errors, Unset):
            errors = []
            for errors_item_data in self.errors:
                errors_item = errors_item_data.to_dict()
                errors.append(errors_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "title": title,
            "status": status,
        })
        if detail is not UNSET:
            field_dict["detail"] = detail
        if instance is not UNSET:
            field_dict["instance"] = instance
        if errors is not UNSET:
            field_dict["errors"] = errors

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.problem_errors_item import ProblemErrorsItem
        d = dict(src_dict)
        type_ = d.pop("type")

        title = d.pop("title")

        status = d.pop("status")

        detail = d.pop("detail", UNSET)

        instance = d.pop("instance", UNSET)

        errors = []
        _errors = d.pop("errors", UNSET)
        for errors_item_data in (_errors or []):
            errors_item = ProblemErrorsItem.from_dict(errors_item_data)



            errors.append(errors_item)


        problem = cls(
            type_=type_,
            title=title,
            status=status,
            detail=detail,
            instance=instance,
            errors=errors,
        )


        problem.additional_properties = d
        return problem

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
