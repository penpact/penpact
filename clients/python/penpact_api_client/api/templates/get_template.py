from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.template import Template
from typing import cast
from uuid import UUID



def _get_kwargs(
    template_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v1/templates/{template_id}".format(template_id=template_id,),
    }


    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[Problem, Template]]:
    if response.status_code == 200:
        response_200 = Template.from_dict(response.json())



        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[Problem, Template]]:
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

) -> Response[Union[Problem, Template]]:
    """ Get a template

    Args:
        template_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, Template]]
     """


    kwargs = _get_kwargs(
        template_id=template_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Problem, Template]]:
    """ Get a template

    Args:
        template_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, Template]
     """


    return sync_detailed(
        template_id=template_id,
client=client,

    ).parsed

async def asyncio_detailed(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Response[Union[Problem, Template]]:
    """ Get a template

    Args:
        template_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Problem, Template]]
     """


    kwargs = _get_kwargs(
        template_id=template_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    template_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],

) -> Optional[Union[Problem, Template]]:
    """ Get a template

    Args:
        template_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Problem, Template]
     """


    return (await asyncio_detailed(
        template_id=template_id,
client=client,

    )).parsed
