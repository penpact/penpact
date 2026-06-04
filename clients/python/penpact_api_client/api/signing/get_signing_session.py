from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.signing_session import SigningSession
from typing import cast



def _get_kwargs(
    signing_token: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/sign/{signing_token}".format(signing_token=signing_token,),
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Problem, SigningSession]]:
    if response.status_code == 200:
        response_200 = SigningSession.from_dict(response.json())



        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if response.status_code == 410:
        response_410 = Problem.from_dict(response.json())



        return response_410

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Problem, SigningSession]]:
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

) -> Response[Union[Problem, SigningSession]]:
    """ Get the signing session

    Args:
        signing_token (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, SigningSession]]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Problem, SigningSession]]:
    """ Get the signing session

    Args:
        signing_token (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, SigningSession]
     """


    return sync_detailed(
        signing_token=signing_token,
client=client,

    ).parsed

async def asyncio_detailed(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[Problem, SigningSession]]:
    """ Get the signing session

    Args:
        signing_token (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, SigningSession]]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Problem, SigningSession]]:
    """ Get the signing session

    Args:
        signing_token (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, SigningSession]
     """


    return (await asyncio_detailed(
        signing_token=signing_token,
client=client,

    )).parsed
