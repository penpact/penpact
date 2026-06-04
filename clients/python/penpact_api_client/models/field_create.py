from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.field_type import FieldType
from ..types import UNSET, Unset
from typing import cast
from typing import Union
from uuid import UUID

if TYPE_CHECKING:
  from ..models.field_condition import FieldCondition





T = TypeVar("T", bound="FieldCreate")



@_attrs_define
class FieldCreate:
    """ 
        Attributes:
            type_ (FieldType):
            signer_id (UUID):
            page (int):
            x (float):
            y (float):
            width (float):
            height (float):
            document_id (Union[Unset, UUID]): Which source document the field is on (required for multi-document envelopes).
            required (Union[Unset, bool]):  Default: True.
            options (Union[Unset, list[str]]): Choices for dropdown/radio fields.
            condition (Union[Unset, FieldCondition]): Show/require this field only when another field equals a value.
     """

    type_: FieldType
    signer_id: UUID
    page: int
    x: float
    y: float
    width: float
    height: float
    document_id: Union[Unset, UUID] = UNSET
    required: Union[Unset, bool] = True
    options: Union[Unset, list[str]] = UNSET
    condition: Union[Unset, 'FieldCondition'] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.field_condition import FieldCondition
        type_ = self.type_.value

        signer_id = str(self.signer_id)

        page = self.page

        x = self.x

        y = self.y

        width = self.width

        height = self.height

        document_id: Union[Unset, str] = UNSET
        if not isinstance(self.document_id, Unset):
            document_id = str(self.document_id)

        required = self.required

        options: Union[Unset, list[str]] = UNSET
        if not isinstance(self.options, Unset):
            options = self.options



        condition: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.condition, Unset):
            condition = self.condition.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "signerId": signer_id,
            "page": page,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        })
        if document_id is not UNSET:
            field_dict["documentId"] = document_id
        if required is not UNSET:
            field_dict["required"] = required
        if options is not UNSET:
            field_dict["options"] = options
        if condition is not UNSET:
            field_dict["condition"] = condition

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.field_condition import FieldCondition
        d = dict(src_dict)
        type_ = FieldType(d.pop("type"))




        signer_id = UUID(d.pop("signerId"))




        page = d.pop("page")

        x = d.pop("x")

        y = d.pop("y")

        width = d.pop("width")

        height = d.pop("height")

        _document_id = d.pop("documentId", UNSET)
        document_id: Union[Unset, UUID]
        if isinstance(_document_id,  Unset):
            document_id = UNSET
        else:
            document_id = UUID(_document_id)




        required = d.pop("required", UNSET)

        options = cast(list[str], d.pop("options", UNSET))


        _condition = d.pop("condition", UNSET)
        condition: Union[Unset, FieldCondition]
        if isinstance(_condition,  Unset):
            condition = UNSET
        else:
            condition = FieldCondition.from_dict(_condition)




        field_create = cls(
            type_=type_,
            signer_id=signer_id,
            page=page,
            x=x,
            y=y,
            width=width,
            height=height,
            document_id=document_id,
            required=required,
            options=options,
            condition=condition,
        )


        field_create.additional_properties = d
        return field_create

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
