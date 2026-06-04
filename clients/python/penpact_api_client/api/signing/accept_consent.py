from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.accept_consent_body import AcceptConsentBody
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    signing_token: str,
    *,
    body: AcceptConsentBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/sign/{signing_token}/consent".format(signing_token=signing_token,),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Any, Problem]]:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

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


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Any, Problem]]:
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
    body: AcceptConsentBody,

) -> Response[Union[Any, Problem]]:
    """ Accept the electronic-records consent disclosure (ESIGN §7001(c))

    Args:
        signing_token (str):
        body (AcceptConsentBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Problem]]
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
    body: AcceptConsentBody,

) -> Optional[Union[Any, Problem]]:
    """ Accept the electronic-records consent disclosure (ESIGN §7001(c))

    Args:
        signing_token (str):
        body (AcceptConsentBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Problem]
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
    body: AcceptConsentBody,

) -> Response[Union[Any, Problem]]:
    """ Accept the electronic-records consent disclosure (ESIGN §7001(c))

    Args:
        signing_token (str):
        body (AcceptConsentBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Problem]]
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
    body: AcceptConsentBody,

) -> Optional[Union[Any, Problem]]:
    """ Accept the electronic-records consent disclosure (ESIGN §7001(c))

    Args:
        signing_token (str):
        body (AcceptConsentBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Problem]
     """


    return (await asyncio_detailed(
        signing_token=signing_token,
client=client,
body=body,

    )).parsed
