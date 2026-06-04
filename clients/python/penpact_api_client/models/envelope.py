from collections.abc import Mapping
from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.envelope_mode import EnvelopeMode
from ..models.envelope_status import EnvelopeStatus
from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from typing import cast, Union
from typing import Union
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.field import Field
  from ..models.signer import Signer





T = TypeVar("T", bound="Envelope")



@_attrs_define
class Envelope:
    """ 
        Attributes:
            id (UUID):
            document_name (str):
            status (EnvelopeStatus):
            sender_email (str):
            signers (list['Signer']):
            created_at (datetime.datetime):
            mode (Union[Unset, EnvelopeMode]):
            sender_name (Union[Unset, str]):
            document_hash_original (Union[None, Unset, str]):
            document_hash_final (Union[None, Unset, str]):
            hash_algorithm (Union[Unset, str]):  Default: 'SHA-256'.
            fields (Union[Unset, list['Field']]):
            sent_at (Union[None, Unset, datetime.datetime]):
            completed_at (Union[None, Unset, datetime.datetime]):
            expires_at (Union[None, Unset, datetime.datetime]):
     """

    id: UUID
    document_name: str
    status: EnvelopeStatus
    sender_email: str
    signers: list['Signer']
    created_at: datetime.datetime
    mode: Union[Unset, EnvelopeMode] = UNSET
    sender_name: Union[Unset, str] = UNSET
    document_hash_original: Union[None, Unset, str] = UNSET
    document_hash_final: Union[None, Unset, str] = UNSET
    hash_algorithm: Union[Unset, str] = 'SHA-256'
    fields: Union[Unset, list['Field']] = UNSET
    sent_at: Union[None, Unset, datetime.datetime] = UNSET
    completed_at: Union[None, Unset, datetime.datetime] = UNSET
    expires_at: Union[None, Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.field import Field
        from ..models.signer import Signer
        id = str(self.id)

        document_name = self.document_name

        status = self.status.value

        sender_email = self.sender_email

        signers = []
        for signers_item_data in self.signers:
            signers_item = signers_item_data.to_dict()
            signers.append(signers_item)



        created_at = self.created_at.isoformat()

        mode: Union[Unset, str] = UNSET
        if not isinstance(self.mode, Unset):
            mode = self.mode.value


        sender_name = self.sender_name

        document_hash_original: Union[None, Unset, str]
        if isinstance(self.document_hash_original, Unset):
            document_hash_original = UNSET
        else:
            document_hash_original = self.document_hash_original

        document_hash_final: Union[None, Unset, str]
        if isinstance(self.document_hash_final, Unset):
            document_hash_final = UNSET
        else:
            document_hash_final = self.document_hash_final

        hash_algorithm = self.hash_algorithm

        fields: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.fields, Unset):
            fields = []
            for fields_item_data in self.fields:
                fields_item = fields_item_data.to_dict()
                fields.append(fields_item)



        sent_at: Union[None, Unset, str]
        if isinstance(self.sent_at, Unset):
            sent_at = UNSET
        elif isinstance(self.sent_at, datetime.datetime):
            sent_at = self.sent_at.isoformat()
        else:
            sent_at = self.sent_at

        completed_at: Union[None, Unset, str]
        if isinstance(self.completed_at, Unset):
            completed_at = UNSET
        elif isinstance(self.completed_at, datetime.datetime):
            completed_at = self.completed_at.isoformat()
        else:
            completed_at = self.completed_at

        expires_at: Union[None, Unset, str]
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "documentName": document_name,
            "status": status,
            "senderEmail": sender_email,
            "signers": signers,
            "createdAt": created_at,
        })
        if mode is not UNSET:
            field_dict["mode"] = mode
        if sender_name is not UNSET:
            field_dict["senderName"] = sender_name
        if document_hash_original is not UNSET:
            field_dict["documentHashOriginal"] = document_hash_original
        if document_hash_final is not UNSET:
            field_dict["documentHashFinal"] = document_hash_final
        if hash_algorithm is not UNSET:
            field_dict["hashAlgorithm"] = hash_algorithm
        if fields is not UNSET:
            field_dict["fields"] = fields
        if sent_at is not UNSET:
            field_dict["sentAt"] = sent_at
        if completed_at is not UNSET:
            field_dict["completedAt"] = completed_at
        if expires_at is not UNSET:
            field_dict["expiresAt"] = expires_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.field import Field
        from ..models.signer import Signer
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        document_name = d.pop("documentName")

        status = EnvelopeStatus(d.pop("status"))




        sender_email = d.pop("senderEmail")

        signers = []
        _signers = d.pop("signers")
        for signers_item_data in (_signers):
            signers_item = Signer.from_dict(signers_item_data)



            signers.append(signers_item)


        created_at = isoparse(d.pop("createdAt"))




        _mode = d.pop("mode", UNSET)
        mode: Union[Unset, EnvelopeMode]
        if isinstance(_mode,  Unset):
            mode = UNSET
        else:
            mode = EnvelopeMode(_mode)




        sender_name = d.pop("senderName", UNSET)

        def _parse_document_hash_original(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        document_hash_original = _parse_document_hash_original(d.pop("documentHashOriginal", UNSET))


        def _parse_document_hash_final(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        document_hash_final = _parse_document_hash_final(d.pop("documentHashFinal", UNSET))


        hash_algorithm = d.pop("hashAlgorithm", UNSET)

        fields = []
        _fields = d.pop("fields", UNSET)
        for fields_item_data in (_fields or []):
            fields_item = Field.from_dict(fields_item_data)



            fields.append(fields_item)


        def _parse_sent_at(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_at_type_0 = isoparse(data)



                return sent_at_type_0
            except: # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        sent_at = _parse_sent_at(d.pop("sentAt", UNSET))


        def _parse_completed_at(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                completed_at_type_0 = isoparse(data)



                return completed_at_type_0
            except: # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        completed_at = _parse_completed_at(d.pop("completedAt", UNSET))


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


        envelope = cls(
            id=id,
            document_name=document_name,
            status=status,
            sender_email=sender_email,
            signers=signers,
            created_at=created_at,
            mode=mode,
            sender_name=sender_name,
            document_hash_original=document_hash_original,
            document_hash_final=document_hash_final,
            hash_algorithm=hash_algorithm,
            fields=fields,
            sent_at=sent_at,
            completed_at=completed_at,
            expires_at=expires_at,
        )


        envelope.additional_properties = d
        return envelope

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
