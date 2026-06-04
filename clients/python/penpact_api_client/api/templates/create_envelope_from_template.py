from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.envelope import Envelope
from ...models.instantiate_template import InstantiateTemplate
from ...models.problem import Problem
from typing import cast
from uuid import UUID



def _get_kwargs(
    template_id: UUID,
    *,
    body: InstantiateTemplate,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/templates/{template_id}/envelopes".format(template_id=template_id,),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Envelope, Problem]]:
    if response.status_code == 201:
        response_201 = Envelope.from_dict(response.json())



        return response_201

    if response.status_code == 409:
        response_409 = Problem.from_dict(response.json())



        return response_409

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Envelope, Problem]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: InstantiateTemplate,

) -> Response[Union[Envelope, Problem]]:
    """ Create an envelope from a template

    Args:
        template_id (UUID):
        body (InstantiateTemplate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Envelope, Problem]]
     """


    kwargs = _get_kwargs(
        template_id=template_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: InstantiateTemplate,

) -> Optional[Union[Envelope, Problem]]:
    """ Create an envelope from a template

    Args:
        template_id (UUID):
        body (InstantiateTemplate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Envelope, Problem]
     """


    return sync_detailed(
        template_id=template_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: InstantiateTemplate,

) -> Response[Union[Envelope, Problem]]:
    """ Create an envelope from a template

    Args:
        template_id (UUID):
        body (InstantiateTemplate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Envelope, Problem]]
     """


    kwargs = _get_kwargs(
        template_id=template_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: InstantiateTemplate,

) -> Optional[Union[Envelope, Problem]]:
    """ Create an envelope from a template

    Args:
        template_id (UUID):
        body (InstantiateTemplate):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Envelope, Problem]
     """


    return (await asyncio_detailed(
        template_id=template_id,
client=client,
body=body,

    )).parsed
