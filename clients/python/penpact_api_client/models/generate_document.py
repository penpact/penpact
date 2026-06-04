from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.locale import Locale
from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from typing import cast, Union
from typing import Union
import datetime

if TYPE_CHECKING:
  from ..models.signer_create import SignerCreate
  from ..models.generate_document_variables import GenerateDocumentVariables





T = TypeVar("T", bound="GenerateDocument")



@_attrs_define
class GenerateDocument:
    """ 
        Attributes:
            document_name (str):
            template (str): Markdown-ish template; supports # / ## headings, - bullets, and {{variables}}.
            signers (list['SignerCreate']):
            variables (Union[Unset, GenerateDocumentVariables]):
            expires_at (Union[None, Unset, datetime.datetime]):
            reminder_every_hours (Union[Unset, int]):
            locale (Union[Unset, Locale]):
     """

    document_name: str
    template: str
    signers: list['SignerCreate']
    variables: Union[Unset, 'GenerateDocumentVariables'] = UNSET
    expires_at: Union[None, Unset, datetime.datetime] = UNSET
    reminder_every_hours: Union[Unset, int] = UNSET
    locale: Union[Unset, Locale] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.signer_create import SignerCreate
        from ..models.generate_document_variables import GenerateDocumentVariables
        document_name = self.document_name

        template = self.template

        signers = []
        for signers_item_data in self.signers:
            signers_item = signers_item_data.to_dict()
            signers.append(signers_item)



        variables: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.variables, Unset):
            variables = self.variables.to_dict()

        expires_at: Union[None, Unset, str]
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        reminder_every_hours = self.reminder_every_hours

        locale: Union[Unset, str] = UNSET
        if not isinstance(self.locale, Unset):
            locale = self.locale.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "documentName": document_name,
            "template": template,
            "signers": signers,
        })
        if variables is not UNSET:
            field_dict["variables"] = variables
        if expires_at is not UNSET:
            field_dict["expiresAt"] = expires_at
        if reminder_every_hours is not UNSET:
            field_dict["reminderEveryHours"] = reminder_every_hours
        if locale is not UNSET:
            field_dict["locale"] = locale

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.signer_create import SignerCreate
        from ..models.generate_document_variables import GenerateDocumentVariables
        d = dict(src_dict)
        document_name = d.pop("documentName")

        template = d.pop("template")

        signers = []
        _signers = d.pop("signers")
        for signers_item_data in (_signers):
            signers_item = SignerCreate.from_dict(signers_item_data)



            signers.append(signers_item)


        _variables = d.pop("variables", UNSET)
        variables: Union[Unset, GenerateDocumentVariables]
        if isinstance(_variables,  Unset):
            variables = UNSET
        else:
            variables = GenerateDocumentVariables.from_dict(_variables)




        def _parse_expires_at(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = isoparse(data)



                return expires_at_type_0
            except: # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        expires_at = _parse_expires_at(d.pop("expiresAt", UNSET))


        reminder_every_hours = d.pop("reminderEveryHours", UNSET)

        _locale = d.pop("locale", UNSET)
        locale: Union[Unset, Locale]
        if isinstance(_locale,  Unset):
            locale = UNSET
        else:
            locale = Locale(_locale)




        generate_document = cls(
            document_name=document_name,
            template=template,
            signers=signers,
            variables=variables,
            expires_at=expires_at,
            reminder_every_hours=reminder_every_hours,
            locale=locale,
        )


        generate_document.additional_properties = d
        return generate_document

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
