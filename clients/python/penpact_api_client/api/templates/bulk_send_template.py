from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.bulk_send import BulkSend
from ...models.bulk_send_result import BulkSendResult
from ...models.problem import Problem
from typing import cast
from uuid import UUID



def _get_kwargs(
    template_id: UUID,
    *,
    body: BulkSend,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/templates/{template_id}/bulk-send".format(template_id=template_id,),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[BulkSendResult, Problem]]:
    if response.status_code == 202:
        response_202 = BulkSendResult.from_dict(response.json())



        return response_202

    if response.status_code == 409:
        response_409 = Problem.from_dict(response.json())



        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[BulkSendResult, Problem]]:
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
    body: BulkSend,

) -> Response[Union[BulkSendResult, Problem]]:
    """ Send a single-role template to many recipients

    Args:
        template_id (UUID):
        body (BulkSend):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[BulkSendResult, Problem]]
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
    body: BulkSend,

) -> Optional[Union[BulkSendResult, Problem]]:
    """ Send a single-role template to many recipients

    Args:
        template_id (UUID):
        body (BulkSend):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[BulkSendResult, Problem]
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
    body: BulkSend,

) -> Response[Union[BulkSendResult, Problem]]:
    """ Send a single-role template to many recipients

    Args:
        template_id (UUID):
        body (BulkSend):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[BulkSendResult, Problem]]
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
    body: BulkSend,

) -> Optional[Union[BulkSendResult, Problem]]:
    """ Send a single-role template to many recipients

    Args:
        template_id (UUID):
        body (BulkSend):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[BulkSendResult, Problem]
     """


    return (await asyncio_detailed(
        template_id=template_id,
client=client,
body=body,

    )).parsed
