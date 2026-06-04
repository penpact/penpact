from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.field_type import FieldType
from ..types import UNSET, Unset
from typing import cast
from typing import cast, Union
from typing import Union
from uuid import UUID

if TYPE_CHECKING:
  from ..models.field_condition import FieldCondition





T = TypeVar("T", bound="Field")



@_attrs_define
class Field:
    """ 
        Attributes:
            type_ (FieldType):
            signer_id (UUID):
            page (int):
            x (float):
            y (float):
            width (float):
            height (float):
            id (UUID):
            document_id (Union[Unset, UUID]): Which source document the field is on (required for multi-document envelopes).
            required (Union[Unset, bool]):  Default: True.
            options (Union[Unset, list[str]]): Choices for dropdown/radio fields.
            condition (Union[Unset, FieldCondition]): Show/require this field only when another field equals a value.
            ai_detected (Union[Unset, bool]):
            value (Union[None, Unset, str]):
     """

    type_: FieldType
    signer_id: UUID
    page: int
    x: float
    y: float
    width: float
    height: float
    id: UUID
    document_id: Union[Unset, UUID] = UNSET
    required: Union[Unset, bool] = True
    options: Union[Unset, list[str]] = UNSET
    condition: Union[Unset, 'FieldCondition'] = UNSET
    ai_detected: Union[Unset, bool] = UNSET
    value: Union[None, Unset, str] = UNSET
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

        id = str(self.id)

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

        ai_detected = self.ai_detected

        value: Union[None, Unset, str]
        if isinstance(self.value, Unset):
            value = UNSET
        else:
            value = self.value


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
            "id": id,
        })
        if document_id is not UNSET:
            field_dict["documentId"] = document_id
        if required is not UNSET:
            field_dict["required"] = required
        if options is not UNSET:
            field_dict["options"] = options
        if condition is not UNSET:
            field_dict["condition"] = condition
        if ai_detected is not UNSET:
            field_dict["aiDetected"] = ai_detected
        if value is not UNSET:
            field_dict["value"] = value

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

        id = UUID(d.pop("id"))




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




        ai_detected = d.pop("aiDetected", UNSET)

        def _parse_value(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        value = _parse_value(d.pop("value", UNSET))


        field = cls(
            type_=type_,
            signer_id=signer_id,
            page=page,
            x=x,
            y=y,
            width=width,
            height=height,
            id=id,
            document_id=document_id,
            required=required,
            options=options,
            condition=condition,
            ai_detected=ai_detected,
            value=value,
        )


        field.additional_properties = d
        return field

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
