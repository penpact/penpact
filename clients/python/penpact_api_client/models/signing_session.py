from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.locale import Locale
from ..models.signing_session_auth_required import SigningSessionAuthRequired
from ..types import UNSET, Unset
from typing import cast
from typing import cast, Union
from typing import Union
from uuid import UUID

if TYPE_CHECKING:
  from ..models.field import Field
  from ..models.signer import Signer
  from ..models.signing_session_branding import SigningSessionBranding
  from ..models.signing_session_documents_item import SigningSessionDocumentsItem
  from ..models.signing_session_consent_disclosure_type_0 import SigningSessionConsentDisclosureType0





T = TypeVar("T", bound="SigningSession")



@_attrs_define
class SigningSession:
    """ 
        Attributes:
            envelope_id (UUID):
            signer (Signer):
            document_url (str): Short-lived URL to the PDF.
            fields (list['Field']):
            consent_required (bool):
            document_name (Union[Unset, str]):
            consent_disclosure (Union['SigningSessionConsentDisclosureType0', None, Unset]):
            auth_required (Union[Unset, SigningSessionAuthRequired]): When present, the signer must pass this challenge
                before the document is shown.
            locale (Union[Unset, Locale]):
            documents (Union[Unset, list['SigningSessionDocumentsItem']]):
            branding (Union[Unset, SigningSessionBranding]):
     """

    envelope_id: UUID
    signer: 'Signer'
    document_url: str
    fields: list['Field']
    consent_required: bool
    document_name: Union[Unset, str] = UNSET
    consent_disclosure: Union['SigningSessionConsentDisclosureType0', None, Unset] = UNSET
    auth_required: Union[Unset, SigningSessionAuthRequired] = UNSET
    locale: Union[Unset, Locale] = UNSET
    documents: Union[Unset, list['SigningSessionDocumentsItem']] = UNSET
    branding: Union[Unset, 'SigningSessionBranding'] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.field import Field
        from ..models.signer import Signer
        from ..models.signing_session_branding import SigningSessionBranding
        from ..models.signing_session_documents_item import SigningSessionDocumentsItem
        from ..models.signing_session_consent_disclosure_type_0 import SigningSessionConsentDisclosureType0
        envelope_id = str(self.envelope_id)

        signer = self.signer.to_dict()

        document_url = self.document_url

        fields = []
        for fields_item_data in self.fields:
            fields_item = fields_item_data.to_dict()
            fields.append(fields_item)



        consent_required = self.consent_required

        document_name = self.document_name

        consent_disclosure: Union[None, Unset, dict[str, Any]]
        if isinstance(self.consent_disclosure, Unset):
            consent_disclosure = UNSET
        elif isinstance(self.consent_disclosure, SigningSessionConsentDisclosureType0):
            consent_disclosure = self.consent_disclosure.to_dict()
        else:
            consent_disclosure = self.consent_disclosure

        auth_required: Union[Unset, str] = UNSET
        if not isinstance(self.auth_required, Unset):
            auth_required = self.auth_required.value


        locale: Union[Unset, str] = UNSET
        if not isinstance(self.locale, Unset):
            locale = self.locale.value


        documents: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.documents, Unset):
            documents = []
            for documents_item_data in self.documents:
                documents_item = documents_item_data.to_dict()
                documents.append(documents_item)



        branding: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.branding, Unset):
            branding = self.branding.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "envelopeId": envelope_id,
            "signer": signer,
            "documentUrl": document_url,
            "fields": fields,
            "consentRequired": consent_required,
        })
        if document_name is not UNSET:
            field_dict["documentName"] = document_name
        if consent_disclosure is not UNSET:
            field_dict["consentDisclosure"] = consent_disclosure
        if auth_required is not UNSET:
            field_dict["authRequired"] = auth_required
        if locale is not UNSET:
            field_dict["locale"] = locale
        if documents is not UNSET:
            field_dict["documents"] = documents
        if branding is not UNSET:
            field_dict["branding"] = branding

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.field import Field
        from ..models.signer import Signer
        from ..models.signing_session_branding import SigningSessionBranding
        from ..models.signing_session_documents_item import SigningSessionDocumentsItem
        from ..models.signing_session_consent_disclosure_type_0 import SigningSessionConsentDisclosureType0
        d = dict(src_dict)
        envelope_id = UUID(d.pop("envelopeId"))




        signer = Signer.from_dict(d.pop("signer"))




        document_url = d.pop("documentUrl")

        fields = []
        _fields = d.pop("fields")
        for fields_item_data in (_fields):
            fields_item = Field.from_dict(fields_item_data)



            fields.append(fields_item)


        consent_required = d.pop("consentRequired")

        document_name = d.pop("documentName", UNSET)

        def _parse_consent_disclosure(data: object) -> Union['SigningSessionConsentDisclosureType0', None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                consent_disclosure_type_0 = SigningSessionConsentDisclosureType0.from_dict(data)



                return consent_disclosure_type_0
            except: # noqa: E722
                pass
            return cast(Union['SigningSessionConsentDisclosureType0', None, Unset], data)

        consent_disclosure = _parse_consent_disclosure(d.pop("consentDisclosure", UNSET))


        _auth_required = d.pop("authRequired", UNSET)
        auth_required: Union[Unset, SigningSessionAuthRequired]
        if isinstance(_auth_required,  Unset):
            auth_required = UNSET
        else:
            auth_required = SigningSessionAuthRequired(_auth_required)




        _locale = d.pop("locale", UNSET)
        locale: Union[Unset, Locale]
        if isinstance(_locale,  Unset):
            locale = UNSET
        else:
            locale = Locale(_locale)




        documents = []
        _documents = d.pop("documents", UNSET)
        for documents_item_data in (_documents or []):
            documents_item = SigningSessionDocumentsItem.from_dict(documents_item_data)



            documents.append(documents_item)


        _branding = d.pop("branding", UNSET)
        branding: Union[Unset, SigningSessionBranding]
        if isinstance(_branding,  Unset):
            branding = UNSET
        else:
            branding = SigningSessionBranding.from_dict(_branding)




        signing_session = cls(
            envelope_id=envelope_id,
            signer=signer,
            document_url=document_url,
            fields=fields,
            consent_required=consent_required,
            document_name=document_name,
            consent_disclosure=consent_disclosure,
            auth_required=auth_required,
            locale=locale,
            documents=documents,
            branding=branding,
        )


        signing_session.additional_properties = d
        return signing_session

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
