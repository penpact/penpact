from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.envelope_status import EnvelopeStatus
from ...models.list_envelopes_response_200 import ListEnvelopesResponse200
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
from typing import Union



def _get_kwargs(
    *,
    status: Union[Unset, EnvelopeStatus] = UNSET,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: Union[Unset, str] = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/envelopes",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[ListEnvelopesResponse200, Problem]]:
    if response.status_code == 200:
        response_200 = ListEnvelopesResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = Problem.from_dict(response.json())



        return response_401

    if response.status_code == 429:
        response_429 = Problem.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[ListEnvelopesResponse200, Problem]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    status: Union[Unset, EnvelopeStatus] = UNSET,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 20,

) -> Response[Union[ListEnvelopesResponse200, Problem]]:
    """ List envelopes

    Args:
        status (Union[Unset, EnvelopeStatus]):
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[ListEnvelopesResponse200, Problem]]
     """


    kwargs = _get_kwargs(
        status=status,
cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: Union[AuthenticatedClient, Client],
    status: Union[Unset, EnvelopeStatus] = UNSET,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 20,

) -> Optional[Union[ListEnvelopesResponse200, Problem]]:
    """ List envelopes

    Args:
        status (Union[Unset, EnvelopeStatus]):
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[ListEnvelopesResponse200, Problem]
     """


    return sync_detailed(
        client=client,
status=status,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: Union[AuthenticatedClient, Client],
    status: Union[Unset, EnvelopeStatus] = UNSET,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 20,

) -> Response[Union[ListEnvelopesResponse200, Problem]]:
    """ List envelopes

    Args:
        status (Union[Unset, EnvelopeStatus]):
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[ListEnvelopesResponse200, Problem]]
     """


    kwargs = _get_kwargs(
        status=status,
cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: Union[AuthenticatedClient, Client],
    status: Union[Unset, EnvelopeStatus] = UNSET,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 20,

) -> Optional[Union[ListEnvelopesResponse200, Problem]]:
    """ List envelopes

    Args:
        status (Union[Unset, EnvelopeStatus]):
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[ListEnvelopesResponse200, Problem]
     """


    return (await asyncio_detailed(
        client=client,
status=status,
cursor=cursor,
limit=limit,

    )).parsed
