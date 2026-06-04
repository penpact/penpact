from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from typing import cast
from uuid import UUID



def _get_kwargs(
    envelope_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/envelopes/{envelope_id}/document".format(envelope_id=envelope_id,),
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
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Problem]:
    """ Download the document

     Returns the sealed final PDF once completed, otherwise the current source PDF.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
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

) -> Optional[Problem]:
    """ Download the document

     Returns the sealed final PDF once completed, otherwise the current source PDF.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return sync_detailed(
        envelope_id=envelope_id,
client=client,

    ).parsed

async def asyncio_detailed(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Problem]:
    """ Download the document

     Returns the sealed final PDF once completed, otherwise the current source PDF.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
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

) -> Optional[Problem]:
    """ Download the document

     Returns the sealed final PDF once completed, otherwise the current source PDF.

    Args:
        envelope_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return (await asyncio_detailed(
        envelope_id=envelope_id,
client=client,

    )).parsed
