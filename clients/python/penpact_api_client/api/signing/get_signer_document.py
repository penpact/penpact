from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
from typing import Union
from uuid import UUID



def _get_kwargs(
    signing_token: str,
    *,
    document_id: Union[Unset, UUID] = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_document_id: Union[Unset, str] = UNSET
    if not isinstance(document_id, Unset):
        json_document_id = str(document_id)
    params["documentId"] = json_document_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/sign/{signing_token}/document".format(signing_token=signing_token,),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Problem]:
    if response.status_code == 401:
        response_401 = Problem.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    document_id: Union[Unset, UUID] = UNSET,

) -> Response[Problem]:
    """ Download the document being signed

    Args:
        signing_token (str):
        document_id (Union[Unset, UUID]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,
document_id=document_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    document_id: Union[Unset, UUID] = UNSET,

) -> Optional[Problem]:
    """ Download the document being signed

    Args:
        signing_token (str):
        document_id (Union[Unset, UUID]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return sync_detailed(
        signing_token=signing_token,
client=client,
document_id=document_id,

    ).parsed

async def asyncio_detailed(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    document_id: Union[Unset, UUID] = UNSET,

) -> Response[Problem]:
    """ Download the document being signed

    Args:
        signing_token (str):
        document_id (Union[Unset, UUID]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,
document_id=document_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    document_id: Union[Unset, UUID] = UNSET,

) -> Optional[Problem]:
    """ Download the document being signed

    Args:
        signing_token (str):
        document_id (Union[Unset, UUID]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return (await asyncio_detailed(
        signing_token=signing_token,
client=client,
document_id=document_id,

    )).parsed
