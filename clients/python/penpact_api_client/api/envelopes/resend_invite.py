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
    signer_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/envelopes/{envelope_id}/signers/{signer_id}/resend".format(envelope_id=envelope_id,signer_id=signer_id,),
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Any, Problem]]:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Any, Problem]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    envelope_id: UUID,
    signer_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[Any, Problem]]:
    """ Resend a signer's invitation

    Args:
        envelope_id (UUID):
        signer_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,
signer_id=signer_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    envelope_id: UUID,
    signer_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Any, Problem]]:
    """ Resend a signer's invitation

    Args:
        envelope_id (UUID):
        signer_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Problem]
     """


    return sync_detailed(
        envelope_id=envelope_id,
signer_id=signer_id,
client=client,

    ).parsed

async def asyncio_detailed(
    envelope_id: UUID,
    signer_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[Any, Problem]]:
    """ Resend a signer's invitation

    Args:
        envelope_id (UUID):
        signer_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,
signer_id=signer_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    envelope_id: UUID,
    signer_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Any, Problem]]:
    """ Resend a signer's invitation

    Args:
        envelope_id (UUID):
        signer_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Problem]
     """


    return (await asyncio_detailed(
        envelope_id=envelope_id,
signer_id=signer_id,
client=client,

    )).parsed
