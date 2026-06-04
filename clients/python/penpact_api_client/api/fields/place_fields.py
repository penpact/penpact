from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.place_fields_body import PlaceFieldsBody
from ...models.place_fields_response_201 import PlaceFieldsResponse201
from ...models.problem import Problem
from typing import cast
from uuid import UUID



def _get_kwargs(
    envelope_id: UUID,
    *,
    body: PlaceFieldsBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v1/envelopes/{envelope_id}/fields".format(envelope_id=envelope_id,),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Optional[Union[PlaceFieldsResponse201, Problem]]:
    if response.status_code == 201:
        response_201 = PlaceFieldsResponse201.from_dict(response.json())



        return response_201

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


def _build_response(*, client: Union[AuthenticatedClient, Client], response: httpx.Response) -> Response[Union[PlaceFieldsResponse201, Problem]]:
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
    body: PlaceFieldsBody,

) -> Response[Union[PlaceFieldsResponse201, Problem]]:
    """ Place fields

    Args:
        envelope_id (UUID):
        body (PlaceFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[PlaceFieldsResponse201, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: PlaceFieldsBody,

) -> Optional[Union[PlaceFieldsResponse201, Problem]]:
    """ Place fields

    Args:
        envelope_id (UUID):
        body (PlaceFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[PlaceFieldsResponse201, Problem]
     """


    return sync_detailed(
        envelope_id=envelope_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: PlaceFieldsBody,

) -> Response[Union[PlaceFieldsResponse201, Problem]]:
    """ Place fields

    Args:
        envelope_id (UUID):
        body (PlaceFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[PlaceFieldsResponse201, Problem]]
     """


    kwargs = _get_kwargs(
        envelope_id=envelope_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    envelope_id: UUID,
    *,
    client: Union[AuthenticatedClient, Client],
    body: PlaceFieldsBody,

) -> Optional[Union[PlaceFieldsResponse201, Problem]]:
    """ Place fields

    Args:
        envelope_id (UUID):
        body (PlaceFieldsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[PlaceFieldsResponse201, Problem]
     """


    return (await asyncio_detailed(
        envelope_id=envelope_id,
client=client,
body=body,

    )).parsed
