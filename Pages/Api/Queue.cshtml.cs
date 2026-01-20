using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages.Api;

[IgnoreAntiforgeryToken]
public class QueueModel : PageModel
{
    private readonly IQueueService _queueService;

    public QueueModel(IQueueService queueService)
    {
        _queueService = queueService;
    }

    // GET /api/queue?handler=get&profileId=xxx
    public async Task<IActionResult> OnGetGetAsync(string profileId)
    {
        if (string.IsNullOrEmpty(profileId))
        {
            return new JsonResult(ApiResponse<PlaybackQueueDto>.Fail("Profile ID is required"));
        }

        var queue = await _queueService.GetQueueAsync(profileId);
        if (queue == null)
        {
            return new JsonResult(ApiResponse<PlaybackQueueDto?>.Ok(null));
        }

        return new JsonResult(ApiResponse<PlaybackQueueDto>.Ok(queue));
    }

    // POST /api/queue?handler=set&profileId=xxx
    public async Task<IActionResult> OnPostSetAsync(string profileId, [FromBody] SetQueueRequest request)
    {
        if (string.IsNullOrEmpty(profileId))
        {
            return new JsonResult(ApiResponse<PlaybackQueueDto>.Fail("Profile ID is required"));
        }

        var queue = await _queueService.SetQueueAsync(profileId, request);
        if (queue == null)
        {
            return new JsonResult(ApiResponse<PlaybackQueueDto>.Fail("Profile not found"));
        }

        return new JsonResult(ApiResponse<PlaybackQueueDto>.Ok(queue));
    }

    // PUT /api/queue?handler=index&profileId=xxx
    public async Task<IActionResult> OnPutIndexAsync(string profileId, [FromBody] UpdateQueueIndexRequest request)
    {
        if (string.IsNullOrEmpty(profileId))
        {
            return new JsonResult(ApiResponse.Fail("Profile ID is required"));
        }

        var success = await _queueService.UpdateQueueIndexAsync(profileId, request.CurrentIndex);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Queue not found"));
        }

        return new JsonResult(ApiResponse.Ok());
    }

    // DELETE /api/queue?handler=clear&profileId=xxx
    public async Task<IActionResult> OnDeleteClearAsync(string profileId)
    {
        if (string.IsNullOrEmpty(profileId))
        {
            return new JsonResult(ApiResponse.Fail("Profile ID is required"));
        }

        var success = await _queueService.ClearQueueAsync(profileId);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Profile not found"));
        }

        return new JsonResult(ApiResponse.Ok());
    }
}
