from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.decline_signing_body import DeclineSigningBody
from ...models.problem import Problem
from ...models.signer import Signer
from typing import cast



def _get_kwargs(
    signing_token: str,
    *,
    body: DeclineSigningBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/sign/{signing_token}/decline".format(signing_token=signing_token,),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Problem, Signer]]:
    if response.status_code == 200:
        response_200 = Signer.from_dict(response.json())



        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if response.status_code == 409:
        response_409 = Problem.from_dict(response.json())



        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Problem, Signer]]:
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
    body: DeclineSigningBody,

) -> Response[Union[Problem, Signer]]:
    """ Decline to sign

    Args:
        signing_token (str):
        body (DeclineSigningBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, Signer]]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: DeclineSigningBody,

) -> Optional[Union[Problem, Signer]]:
    """ Decline to sign

    Args:
        signing_token (str):
        body (DeclineSigningBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, Signer]
     """


    return sync_detailed(
        signing_token=signing_token,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: DeclineSigningBody,

) -> Response[Union[Problem, Signer]]:
    """ Decline to sign

    Args:
        signing_token (str):
        body (DeclineSigningBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, Signer]]
     """


    kwargs = _get_kwargs(
        signing_token=signing_token,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    signing_token: str,
    *,
    client: Union[AuthenticatedClient, Client],
    body: DeclineSigningBody,

) -> Optional[Union[Problem, Signer]]:
    """ Decline to sign

    Args:
        signing_token (str):
        body (DeclineSigningBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, Signer]
     """


    return (await asyncio_detailed(
        signing_token=signing_token,
client=client,
body=body,

    )).parsed
