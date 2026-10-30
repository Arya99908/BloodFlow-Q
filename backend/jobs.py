"""Bounded compute admission; production jobs execute in disposable processes."""
import multiprocessing
import threading
from backend.services import APIServiceError

_SLOTS = threading.BoundedSemaphore(2)
JOB_TIMEOUT_SECONDS = 60


def _invoke(service, operation, request):
    if operation == 'flagship':
        from backend.flagship import run_flagship
        return run_flagship(request, service)
    return getattr(service, operation)(request)


def _worker(connection, operation, request):
    try:
        from backend.services import BackendService
        connection.send(('ok', _invoke(BackendService(), operation, request)))
    except APIServiceError as error:
        connection.send(('error', (error.status_code, error.detail, error.code)))
    except Exception:
        connection.send(('error', (500, 'Compute worker failed; no result was published.', 'worker_failure')))
    finally:
        connection.close()


def execute(service, operation, request):
    if operation not in {'optimize','simulate_emergency','benchmark','run_demo','flagship'}:
        raise ValueError('Unknown compute operation')
    if not _SLOTS.acquire(blocking=False):
        raise APIServiceError(429, 'Two compute jobs are already running. Retry shortly.', 'compute_busy')
    try:
        if not getattr(service, 'isolate_jobs', False):
            return _invoke(service, operation, request)
        context = multiprocessing.get_context('spawn')
        receive, send = context.Pipe(duplex=False)
        process = context.Process(target=_worker, args=(send,operation,request))
        try:
            process.start()
            send.close()
            if not receive.poll(JOB_TIMEOUT_SECONDS):
                raise APIServiceError(504, 'The compute job exceeded its 60-second deadline; worker stopped.', 'compute_timeout')
            try:
                status, payload = receive.recv()
            except EOFError as error:
                raise APIServiceError(502, 'Compute worker ended without a result.', 'worker_failure') from error
            if status == 'error':
                raise APIServiceError(*payload)
            service._save('/'+operation.replace('_','-'), payload)
            return payload
        finally:
            receive.close(); send.close()
            if process.pid is not None:
                process.join(timeout=.1)
                if process.is_alive():
                    process.terminate(); process.join(timeout=1)
                if process.is_alive():
                    process.kill(); process.join()
                process.close()
    finally:
        _SLOTS.release()
