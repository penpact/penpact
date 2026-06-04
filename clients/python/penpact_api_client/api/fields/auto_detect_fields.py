from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.auto_detect_fields_response_200 import AutoDetectFieldsResponse200
from ...models.problem import Problem
from typing import cast
from uuid import UUID



def _get_kwargs(
    envelope_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/envelopes/{envelope_id}/fields/auto-detect".format(envelope_id=envelope_id,),
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[AutoDetectFieldsResponse200, Problem]]:
    if response.status_code == 200:
        response_200 = AutoDetectFieldsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = Problem.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[AutoDetectFieldsResponse200, Problem]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[AutoDetectFieldsResponse200, Problem]]:
    """ Auto-detect fields (AI)

     Run AI field detection over the uploaded PDF and return proposed fields.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AutoDetectFieldsResponse200, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[AutoDetectFieldsResponse200, Problem]]:
    """ Auto-detect fields (AI)

     Run AI field detection over the uploaded PDF and return proposed fields.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[AutoDetectFieldsResponse200, Problem]
     """


    return sync_detailed(
        envelope_id=envelope_id,
client=client,

    ).parsed

async def asyncio_detailed(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[AutoDetectFieldsResponse200, Problem]]:
    """ Auto-detect fields (AI)

     Run AI field detection over the uploaded PDF and return proposed fields.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[AutoDetectFieldsResponse200, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[AutoDetectFieldsResponse200, Problem]]:
    """ Auto-detect fields (AI)

     Run AI field detection over the uploaded PDF and return proposed fields.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[AutoDetectFieldsResponse200, Problem]
     """


    return (await asyncio_detailed(
        envelope_id=envelope_id,
client=client,

    )).parsed
