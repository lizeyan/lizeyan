# 大型 Python 服务的异步改造：经验总结与最佳实践

> 🎉 本文总结了一个每分钟处理数百万次I/O操作的Python服务从多线程迁移到asyncio的实践经验。通过分析多线程模型在资源控制方面的根本性挑战，说明了协程方案的优越性。实践表明，迁移后服务的并发处理能力提升近十倍，同时保持了稳定的资源占用。文章将详细探讨迁移策略和最佳实践。

> 图片：飞书文档 - 图片

## 引言

在过去的半年里，我们对一个I/O 密集型的 Python 服务进行了 异步改造。该服务每分钟需要处理数十上百万次 I/O 操作。在这种业务场景中，多线程模型面临着一个根本性的资源控制挑战：复杂的调用链路中，每个环节都可能需要并发处理多个 I/O 操作。这种场景下，传统的线程池方案存在两个难以解决的问题：

1. 资源膨胀：如果允许各层函数独立创建线程池，线程总数会失控增长，并很快用光所有内存。
2. 资源阻塞：使用全局线程池，由于线程很难优雅终止，长时间阻塞的任务会持续占用线程资源，最终导致线程池耗尽，服务响应能力严重下降
正是这个根本性的架构缺陷促使我们开始考虑协程方案。协程通过轻量级的并发机制和精确的资源控制完美解决了这个问题，这也是多线程方案无法替代协程的关键原因。通过将传统的多线程模型迁移至异步编程范式，服务的并发处理能力提升了近十倍，而系统资源占用却保持在相对稳定的水平。

这是一次富有成效的技术升级。这个成功案例让我们确信，对于那些 I/O 密集型的 Python 服务，迁移到 asyncio 是一个值得投入的技术选择。特别是考虑到 Python 的 GIL 限制和线程调度开销，asyncio 的协程机制能提供更轻量且优雅的并发解决方案。因此，我们强烈建议新项目在架构设计时优先考虑 asyncio，而对于现存的系统，也应该渐进式地进行异步化改造。

本文将分享我们在这次技术迁移中的经验和最佳实践。本文共分为四个主要部分：首先介绍asyncio的核心工作原理；其次深入对比协程与线程的优劣势，重点分析事件切换机制、任务取消能力以及async/await的传染性特征；第三部分梳理asyncio相关的第三方生态系统；最后总结项目异步改造的关键策略和注意事项。

## 理解asyncio的工作原理

## Event Loop工作机制

事件循环(Event Loop)是asyncio的核心，它管理和协调所有异步任务的执行。可以将事件循环想象成一个永不停止的循环，不断检查并执行可以运行的协程。

下面是一个简单的例子来说明事件循环是如何工作的：

```text
Python
取消自动换行
复制
import asyncio
import time

async def task1():
    print("Task 1 started")
    await asyncio.sleep(2)  # 模拟IO操作
    print("Task 1 finished")

async def task2():
    print("Task 2 started")
    await asyncio.sleep(1)  # 模拟IO操作
    print("Task 2 finished")

async def main():
    # 创建两个任务
    t1 = asyncio.create_task(task1())
    t2 = asyncio.create_task(task2())
    
    # 等待两个任务完成
    await t1
    await t2

# 运行事件循环
asyncio.run(main())
```

详细的事件循环工作流程：

1. 初始化阶段：
  - asyncio.run(main()) 创建一个新的事件循环
  - 事件循环开始执行 main() 协程
2. 任务创建阶段：
  - asyncio.create_task(task1()) 执行： ▪ 将 task1 协程包装成 Task 对象 ▪ 这个 Task 被放入事件循环的任务队列
- 将 task1 协程包装成 Task 对象
- 这个 Task 被放入事件循环的任务队列
  - asyncio.create_task(task2()) 执行： ▪ 将 task2 协程包装成 Task 对象
- 将 task2 协程包装成 Task 对象
6. Task2 恢复执行：
7. 等待阶段（后1秒）：
8. Task1 恢复执行：
9. 完成阶段：
## asyncio基本用法

```text
Python
取消自动换行
复制
import asyncio

# 1. async定义协程函数
async def fetch_data():
    print("开始获取数据")
    await asyncio.sleep(2)  # await用于等待其他协程
    return "数据"

# 2. create_task创建任务
async def main():
    # 创建任务
    task1 = asyncio.create_task(fetch_data())
    task2 = asyncio.create_task(fetch_data())
    
    # gather用于等待多个协程
    results = await asyncio.gather(task1, task2)
    print(results)

    # 另一种等待方式
    task3 = asyncio.create_task(fetch_data())
    result = await task3  # 直接await任务
    print(result)

# 3. asyncio.run运行主协程
asyncio.run(main())
```

### async def - 协程函数

- async def 定义的函数不是普通函数，而是一个协程函数
- 调用协程函数不会立即执行函数体，而是返回一个协程对象
- 协程对象需要通过事件循环来调度执行
```text
Python
取消自动换行
复制
# 这样调用不会执行函数体
coro = fetch_data()  # 返回协程对象（但是没有提交给事件循环）
# 需要通过await或事件循环来执行
await coro  # 在其他协程中使用
```

### await - 等待操作

- await 用于等待一个协程完成并获取其结果
- await 只能在协程函数（async def）内使用
- await 会暂停当前协程的执行，让出控制权给事件循环
- 事件循环可以去执行其他任务
- 被等待的协程完成后，当前协程从 await 处继续执行
```text
Python
取消自动换行
复制
data = await fetch_data()  # 暂停直到fetch_data完成
```

### asyncio.create_task() - 任务创建

- 将协程包装成一个 Task 对象
- Task 会被立即排入事件循环准备执行
- 不会阻塞当前协程的执行
- 返回的 Task 对象可以用于后续等待或取消
```text
Python
取消自动换行
复制
# 创建后一个协程并提交给事件循环，不等待其结果
task = asyncio.create_task(fetch_data())
# 之后可以通过await等待结果
result = await task
```

### asyncio.gather() - 等待所有协程/任务完成

- 等待所有协程/任务完成
- 返回所有结果的列表
- 如果任何任务抛出异常，gather 也会抛出异常
```text
Python
取消自动换行
复制
# 并发执行多个任务
results = await asyncio.gather(task1, task2)
# results 是一个列表，包含所有任务的结果
```

### asyncio.run() - 运行入口

- 创建新的事件循环
- 运行传入的协程直到完成
- 关闭事件循环
- 通常作为异步程序的主入口
- 事件循环不能嵌套，同一个线程只能有一个事件循环在运行
- 事件循环是单线程的，不同的线程运行的事件循环不同
```text
Python
取消自动换行
复制
# 并发执行多个任务
results = await asyncio.gather(task1, task2)
# results 是一个列表，包含所有任务的结果
```

### async with和async for：异步上下文控制和异步迭代器

async with 是异步版本的上下文管理器，是with的异步版本，主要用于管理异步资源的获取和释放。

```text
Python
取消自动换行
复制
class AsyncContextManager:
    async def __aenter__(self):
        # 获取资源
        print("Entering context")
        await asyncio.sleep(1)  # 模拟异步操作
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # 释放资源
        print("Exiting context")
        await asyncio.sleep(1)  # 模拟异步操作

# 使用示例
async def main():
    async with AsyncContextManager() as acm:
        print("Inside context")
```

async for 用于异步迭代，允许在循环中等待异步操作完成。

```text
Python
取消自动换行
复制
class AsyncIterator:
    def __init__(self, limit):
        self.limit = limit
        self.counter = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.counter >= self.limit:
            raise StopAsyncIteration
        self.counter += 1
        await asyncio.sleep(1)  # 模拟异步操作
        return self.counter

# 使用示例
async def main():
    async for num in AsyncIterator(5):
        print(num)
```

## 协程相比线程的优势和劣势

本节总结协程和线程的优劣对比，一些内容会在后面的章节中具体展开。

## ✅ 开销小

关于开销，差异相当显著。在现代操作系统中，一个线程通常需要约 1MB 的内存（包括栈空间），创建时间在微秒级别；而协程只需要几 KB 的内存，创建时间在纳秒级别。这意味着你可以轻松创建数十万个协程，而同样数量的线程可能会耗尽系统资源。具体数据：

- 线程：每个约 1MB 内存，创建时间 10-20 微秒
- 协程：每个约 2-4KB 内存，创建时间约 200-300 纳秒
- 实际测试中，一台普通服务器可以同时运行的线程数通常在几千个，而协程可以轻松达到几十万个
## ✅ 简化了并发编程

线程的切换由操作系统控制，会发生在任何时候，这就需要大量的锁来保护共享数据。而协程是协作式的，只在明确的 await 点切换，这大大简化了并发编程

## ✅ 可取消

协程最大的优势之一是可以安全地取消，这样可以保证资源不会被已经超时的任务占用。

## ❌ 无法真正并行

如果某个操作是 CPU 密集型的（比如大量计算），协程无法提供真正的并行，因为它们还是在同一个线程中运行。不过在Python中这个问题不明显，因为多线程由于GIL也无法真正并行。只有在调用一些特意释放了GIL的代码时多线程才有性能优势。

## ❌ async/await标记传染性｜第三方库生态

异步服务中需要每一处代码都是异步的，这导致代码的迁移会存在一些困难。这也导致第三方库如果想支持异步，就必须完整维护两套API，这显著限制了第三方库的生态。

## 总结

总的来说，如果有异步替代方案，应该优先使用异步库。虽然 Python 的 GIL 确实限制了线程的并行能力，但在特定场景下，线程仍然是必要的工具：

- 与现有同步代码渐进式集成（通过asyncio.to_thread）
- 阻塞型 I/O 操作且无异步接口
## 主动控制事件切换

与多线程不同，异步编程中的任务切换是显式的，只发生在await语句处。这带来了几个重要特性：

## 无并发冲突

因为代码执行不会在非await处被中断，所以在这种代码块中不需要锁来保护共享资源

协程的这一特性为并发编程提供了优雅的解决方案。在传统多线程编程模型中，对共享资源的访问通常需要通过互斥锁、信号量等同步机制来保护，这不仅增加了程序的复杂度，还可能引入死锁等并发问题。而协程模型通过其独特的执行特性，即在非 await 点的代码块具有原子性，大大简化了这一问题。

这种设计使得开发者可以更加自然地组织代码逻辑，无需显式地进行同步控制。由于协程仅在明确的 await 点让出执行权，开发者可以准确预测代码的执行顺序，显著降低了并发编程的复杂度。这不仅提高了代码的可维护性，也减少了潜在的并发错误。

值得注意的是，这种特性并不意味着可以完全忽视并发安全性，await前后的代码仍然可能涉及共享数据冲突的问题。

```text
Python
取消自动换行
复制
import asyncio
import threading
import time
import random
from concurrent.futures import ThreadPoolExecutor

# --------- 多线程版本 ---------
class ThreadCounter:
    def __init__(self):
        self.count = 0
    
    def increment(self):
        current = self.count
        time.sleep(random.random()) # complex computation
        self.count = current + 1
        time.sleep(random.random()) # long IO

# --------- 协程版本 ---------
class AsyncCounter:
    def __init__(self):
        self.count = 0
    
    async def increment(self):
        # 完全相同的非原子操作
        # 但是因为这里没有await，就不会被打断，实际上不会有并发冲突
        current = self.count
        time.sleep(random.random()) # complex computation
        self.count = current + 1
        await asyncio.sleep(random.random()) # long IO

# --------- 运行比较 ---------
async def main():
    print("开始测试...")
```

### ContextVar的使用

当需要在不同协程中维护独立的上下文数据时，可以使用ContextVar

```text
Python
取消自动换行
复制
from contextvars import ContextVar

# 创建上下文变量
request_id = ContextVar('request_id', default=None)

async def process_request(rid):
    # 设置当前协程的request_id
    token = request_id.set(rid)
    try:
        await asyncio.sleep(1)  # 模拟处理
        # 获取当前协程的request_id
        current_id = request_id.get()
        print(f"Processing request {current_id}")
    finally:
        # 恢复之前的值
        request_id.reset(token)

async def main():
    # 并发处理多个请求
    await asyncio.gather(
        process_request("req1"),
        process_request("req2")
    )
```

## 防止事件循环阻塞

在异步编程中，防止事件循环阻塞是一个核心原则，其重要性源于事件循环的工作机制。

事件循环是异步编程的核心调度器，它维护着一个任务队列，通过不断轮询来执行这些任务。当一个协程在非 await 点执行 IO 操作时，事件循环无法切换到其他任务。这种阻塞会带来严重后果，因为其他协程无法执行，即使它们只是等待 I/O。此时系统的并发处理能力实际上被降低到单线程水平

正确的做法是，将 CPU 密集型操作放入线程池，保持事件循环中的操作都是 I/O 密集型或轻量级计算

这就像是一个交通指挥系统，如果某个路口的红绿灯被卡住，整个路网的车流都会受到影响。事件循环也是如此，一个阻塞操作会影响到所有其他任务的执行效率

```text
Python
取消自动换行
复制
import time

async def bad_practice():
    # 这会阻塞事件循环！
    time.sleep(1)  # complex computation
    return "done"

# 如果必须使用同步函数，应该使用to_thread
async def better_practice():
    return await asyncio.to_thread(time.sleep, 1)
```

## 如何发现潜在的阻塞代码

标准库asyncio自带一个debug 选项，可以打印输出运行时间较长的协程（潜在的同步阻塞代码） Developing with asyncio

但是这个标准库提供的日志信息量很少，很难看出来是卡在哪段代码，只能看出来是哪个协程存在阻塞

```text
Python
取消自动换行
复制
2025-01-06 19:18:15 +0800 - __init__.py:1762 - callHandlers - WARNING -  Executing <Task finished name='Task-15' coro=<<coroutine without __name__>()> result=None created at /home/ray/anaconda3/lib/python3.12/asyncio/tasks.py:695> took 3.977 seconds
2025-01-06 19:18:12 +0800 - __init__.py:1762 - callHandlers - WARNING -  Executing <Task finished name='Task-33' coro=<<coroutine without __name__>()> result=[{'missing': [<Missing.ERROR: np.uint8(2)>], 'name': 'web_tos_tosa...front-azb-3"}', 'scores': [0.0], 'timestamps': [1736162040], ...}] created at /home/ray/anaconda3/lib/python3.12/asyncio/tasks.py:695> took 0.370 seconds
2025-01-06 19:16:09 +0800 - __init__.py:1762 - callHandlers - WARNING -  Executing <Task finished name='Task-1895' coro=<<coroutine without __name__>()> result=[{'missing': [<Missing.EXIST: np.uint8(0)>, <Missing.EXIST: np.uint8(0)>], 'name': '[default]tou...5smt1a1g9arj}', 'scores': [0.0, 0.0], 'timestamps': [np.int64(1736161800), np.int64(1736161860)], ...}] created at /home/ray/anaconda3/lib/python3.12/asyncio/tasks.py:695> took 0.104 seconds
2025-01-06 19:16:09 +0800 - __init__.py:1762 - callHandlers - WARNING -  Executing <Task finished name='Task-1895' coro=<<coroutine without __name__>()> result=[{'missing': [<Missing.EXIST: np.uint8(0)>, <Missing.EXIST: np.uint8(0)>], 'name': '[default]tou...5smt1a1g9arj}', 'scores': [0.0, 0.0], 'timestamps': [np.int64(1736161800), np.int64(1736161860)], ...}] created at /home/ray/anaconda3/lib/python3.12/asyncio/tasks.py:695> took 0.104 seconds
```

为此，我自己写了一个监控器。这个监控器往需要监控的事件循环中，提交一个协程，定时将一个计数器加1。然后我在一个单独的线程中，定时检查这个计数器是否在增加。如果没有增加，就说明事件循环卡住了，此时我将事件循环当前的stacktrace打印出来。

```text
Python
取消自动换行
复制
class EventLoopBlockingDetector:
    def __init__(
        self, eventloop: asyncio.AbstractEventLoop, threshold: float = 0.1
    ) -> None:
        self.threshold = threshold
        self.running = False
        self.eventloop = eventloop
        self._last_tic_time = float("inf")
        # 监控线程引用
        self._monitor_thread: typing.Optional[threading.Thread] = None

        # 用于在事件循环中定期更新的标记
        self._loop_tick = 0
```

```text
Python
取消自动换行
复制
2025-01-06 18:43:51 +0800 - __init__.py:1762 - callHandlers - WARNING -  Event loop blocked for 7.485 seconds
Stack trace:
  ...
  File "/home/ray/anaconda3/lib/python3.12/asyncio/format_helpers.py", line 72, in extract_stack
    stack = traceback.StackSummary.extract(traceback.walk_stack(f),
  File "/home/ray/anaconda3/lib/python3.12/traceback.py", line 395, in extract
    return klass._extract_from_extended_frame_gen(
  File "/home/ray/anaconda3/lib/python3.12/traceback.py", line 434, in _extract_from_extended_frame_gen
    linecache.checkcache(filename)
  File "/home/ray/anaconda3/lib/python3.12/linecache.py", line 72, in checkcache
    stat = os.stat(fullname)
```

例如，从上面的日志中，就能很容易看出来代码是卡在os.stat这个同步的文件系统操作上

## 一些容易被忽略的阻塞点

### traceback

Python自带的 traceback.format_exc（格式化调用栈，我们使用这个接口的目的是在日志中打印报错的位置和调用栈信息）（以及相关的format_exception, print_exc等等函数）会扫描源代码文件，从而准确获取源代码。每次调用都需要扫描是因为运行过程中代码可能改变。

这个过程涉及磁盘IO，在一些请求下可能阻塞事件循环1-2s。在我们的场景下，源代码是固定不变的，有了文件名和行号就能定位代码，也不需要直接打印源代码，因此可以手动实现调用栈的格式化，避免访问文件。

```text
Python
取消自动换行
复制
import sys

def format_exc():
    """
    快速格式化当前异常，作为 traceback.format_exc() 的替代品
    返回当前异常的格式化字符串，如果没有异常则返回 None
    """
    # 获取当前异常信息
    exc_type, exc_value, tb = sys.exc_info()
    if exc_type is None:  # 没有活动的异常
        return None

    # 构建异常跟踪信息
    lines = ["Traceback (most recent call last):\n"]

    # 收集堆栈信息
    while tb:
        filename = tb.tb_frame.f_code.co_filename
        function = tb.tb_frame.f_code.co_name
        lineno = tb.tb_lineno
        lines.append(f'  File "{filename}", line {lineno}, in {function}\n')
        tb = tb.tb_next

    # 添加异常类型和消息
    lines.append(f"{exc_type.__name__}: {str(exc_value)}\n")

    return "".join(lines)
```

### logging

在负载很高的时候，logging输出也会阻塞事件循环，特别是需要往stdout和stderr之外的地方写日志的时候。

```text
Python
取消自动换行
复制
Event loop blocked for 7.984 seconds
Stack trace:
  ...
    self.logger.info(f"{operation_name}{operation_log_suffix} start at {tic}")
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1539, in info
    self._log(INFO, msg, args, **kwargs)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1684, in _log
    self.handle(record)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1700, in handle
    self.callHandlers(record)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1762, in callHandlers
    hdlr.handle(record)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1028, in handle
    self.emit(record)
  File "/home/ray/anaconda3/lib/python3.12/logging/handlers.py", line 75, in emit
    logging.FileHandler.emit(self, record)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1280, in emit
    StreamHandler.emit(self, record)
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1164, in emit
    self.flush()
  File "/home/ray/anaconda3/lib/python3.12/logging/__init__.py", line 1144, in flush
    self.stream.flush()
```

为了解决这个问题，可以自定义一个LogHandler。这个LogHandler在收到日志后，只是将LogRecord放到一个队列中就返回，不做任何耗时的操作。然后在单独的线程中，不断将队列中的日志实际完成写入。另外，这个LogHandler还需要释放锁。

```text
Python
取消自动换行
复制
                    record = self._queue.get()
                    if record is None:  # 终止信号
                        break
                    self._actual_emit(record)
                except Exception:
                    pass

        self._worker_thread = threading.Thread(
            target=_worker, name="LockFreeLogHandler-Worker", daemon=True
        )
        self._worker_thread.start()

    def emit(self, record: logging.LogRecord) -> None:
        """无锁地将日志记录放入队列"""
        record.message = f"{log_prefix.get()} {record.getMessage()}"
        self._queue.put(record)

    # noinspection PyMethodMayBeStatic
    def _actual_emit(self, record: logging.LogRecord) -> None:
        """实际的日志处理逻辑"""
        ...
```

### Ray

Ray是一个Python的分布式计算框架，主要用于AI场景。但是，Ray的代码库主要还是同步的，而且有很多很基本的操作也涉及到同步IO。例如：

- actor_handle.method.remote(*args, **kwargs)是调用Actor的语法，但是其中actor_handle.method这样一个简单的访问属性操作，实际上会和Ray cluster有同步的API请求。
- ObjectRef相当于Ray生态的Future，包装了已提交的任务，用于获取返回值或者操作任务状态。但是ObjectRef的析构（__del__）会和Ray cluster有同步的API请求。所以建议将ObjectRef的整个生命周期都放到单独的线程中，不要出现在EventLoop的线程中。
如下是我为异步调用Ray Actor写的一个完整的解决方案，主要有这些优化点：

- 缓存ActorHandle和ClientRemoteMethod，这些正常情况下都是不会变的，只有在Actor重启之后才会变。
- 将Ray相关的调用到放到一个单独的线程中，通过循环调用ray.wait接口实现超时取消。
- 避免并发创建同一个Actor和 method。
```text
Python
取消自动换行
复制
            _aio_create_future_dict.pop(key, None)

@async_single_entrance(maxsize=40960)  # 这个装饰器的功能和aio_create_named_actor中那堆代码是相同的，只是会使用函数的全部参数作为 hash key 而已。
async def aio_get_actor_method_handle(
    actor: ActorHandle, method: str
) -> ClientRemoteMethod:
    return await asyncio.get_running_loop().run_in_executor(
        _executor, getattr, actor, method
    )

async def acall_named_actor(
        actor_name: str,
        method: Callable[ActorMethodParams, ObjectType | Awaitable[ObjectType]],
        expected_type: type[ObjectType],
        *,
        method_args: ActorMethodParams.args = None,  # pyright: ignore [reportInvalidTypeForm]
        method_kwargs: ActorMethodParams.kwargs = None,  # pyright: ignore [reportInvalidTypeForm]
        timeout: float | None = 10.0,
        actor_options: ActorOptions | None = None,
        actor_kwargs: dict | None = None,
) -> ObjectType:
    _loop = asyncio.get_running_loop()
    _run_worker = False

    async def get_or_create_actor_method(
            force: bool = False,
    ) -> Callable[[], ObjectType]:
        global _named_actor_cache
        global _actor_method_cache
        _actor_cache_key = (actor_name, namespace)
        # 清除现有的handle
        if force:
            _old_actor_handle = _named_actor_cache.pop(_actor_cache_key, None)
            if _old_actor_handle is not None:
                _actor_method_cache.pop(_old_actor_handle, None)

        if _actor_cache_key not in _named_actor_cache:
            try:
                _named_actor_cache[_actor_cache_key] = await aio_create_named_actor(
                    actor_name,
                    namespace,
                    actor_class,
                    actor_options,
                    actor_kwargs,
                )
            except Exception as e:
                logging.error(
                    f"Failed to create actor {actor_name}: {e} {format_exc()}"
                )
                raise
        _actor = _named_actor_cache[_actor_cache_key]
        if _actor not in _actor_method_cache:
            _actor_method_cache[_actor] = {}
        if method.__name__ not in _actor_method_cache[_actor]:
            _actor_method_cache[_actor][
                method.__name__
            ] = await aio_get_actor_method_handle(_actor, method.__name__)
        actor_method = _actor_method_cache[_actor][method.__name__]

        def _worker() -> ObjectType:
            _object_ref = actor_method.remote(*method_args, **method_kwargs)
            _stop_at = time.monotonic() + (timeout or float('inf'))
            while _run_worker and time.monotonic() < _stop_at:
                try:
                    _ready, _remaining = ray.wait(
                        [_object_ref],
                        timeout=timeout,
                    )
                    if _ready:
```

## 取消协程

协程最大的优势之一是可以安全地取消。在 Python 中，你可以简单地通过 Task.cancel() 来取消一个协程，它会在下一个挂起点（await）抛出 CancelledError，让协程有机会做清理工作。CancelledError是BaseException而不是Exception的子类，这意味的大部分expect代码都不会捕获CancelledError，只有在明确知道需要处理取消的时候，才需要expect CancelledError。

```text
Python
取消自动换行
复制
async def long_operation():
    try:
        while True:
            await asyncio.sleep(1)
            print("working...")
    except asyncio.CancelledError:
        print("清理资源...")
        raise  # 重新抛出异常，通知调用者已取消

# 取消协程很简单
task = asyncio.create_task(long_operation())
await asyncio.sleep(3)
task.cancel()  # 协程会在下一个 await 点优雅地退出
```

而线程的取消就麻烦得多.Python 没有提供原生的线程取消机制，你只能用一些变通方法比如设置标志位，而且无法保证线程能及时响应取消请求。这是因为线程的上下文切换可以发生在任何位置，一旦允许随意取消，那么就需要在每一行代码都考虑发生异常之后的资源清理问题。

## 安全取消、确保清理资源

在协程的取消机制中，一个常见的误解是认为必须显式捕获 CancelledError 来进行资源清理。实际上，Python 的异步上下文管理器已经为我们优雅地处理了这一问题。当使用 async with 语句管理数据库连接、网络请求、文件操作等资源时，即使任务被取消，上下文管理器也会确保资源得到适当的清理和释放。这使得大多数情况下，我们无需编写专门的异常处理代码。

然而，这种自动化的资源管理机制在涉及线程时会遇到挑战。由于 Python 中线程无法被直接取消，当协程与线程交互时，我们需要特别注意设计合适的线程终止机制，并确保线程所持有的资源能够得到妥善清理。这种情况下，显式的取消处理就变得必要了。

总的来说，协程的取消机制是很优雅的，但前提是所有资源都通过适当的异步接口来管理。如果不得不使用线程，就需要额外的工作来确保资源能被正确清理。这也是为什么在可能的情况下，应该优先选择纯异步的解决方案。

## async/await标记的传染性

async/await标记具有传染性：当你使用await调用一个异步接口的时候，这个await必须位于一个async标记的函数中。而这个async标记的函数就变成了一个异步函数，未来也只能被await（或者asyncio.run、asyncio.create_task）等异步API调用。

```text
Python
取消自动换行
复制
async def fetch_data_from_db(id: int) -> dict:
    # 假设这是一个异步数据库操作
    return {"data": id}

# 第一层传染：使用了异步数据库操作
async def process_user(user_id: int) -> dict:
    data = await fetch_data_from_db(user_id)
    return {"processed": data}

# 第二层传染：使用了异步的 process_user
async def handle_request(request_id: int) -> dict:
    result = await process_user(request_id)
    return {"request": request_id, "result": result}

# 第三层传染：使用了异步的 handle_request
async def api_endpoint(request_id: int) -> dict:
    return await handle_request(request_id)
```

async/await 的传染性本质上源于"承诺"（Promise）与"实际值"的根本区别。当一个函数被标记为 async 时，它不再返回实际的值，而是返回一个"我承诺未来会给你一个值"的承诺对象。这种承诺与实际值是完全不同的两种东西 —— 就像"我承诺给你一个苹果"和"一个苹果"是不同的概念。

一旦代码中出现了这种"承诺"，我们就不能像处理实际值那样处理它。你不能吃掉"一个承诺会给你的苹果"，你必须等到这个承诺兑现。这就是为什么我们需要 await —— 它的作用就是等待承诺兑现并取出实际的值。而当一个函数需要等待某个承诺兑现时，这个函数本身也就变成了一个"承诺"，因为它无法立即给出结果。

这种传染性不是语言设计的缺陷，而是异步编程本质特性的直接体现。它强制我们明确区分"立即可用的值"和"未来才能兑现的承诺"，这种区分对于正确处理异步逻辑是必要的。试图隐藏这种区别只会导致更多的混乱和错误。

同步和异步代码的不兼容性导致了所谓的"双轨制"—— 一个库要么完全同步，要么完全异步，很难在中间找到平衡点。比如 SQLAlchemy 不得不维护 sync 和 async 两套完全不同的 API，requests 和 aiohttp 各自独立发展，Django 和 FastAPI 也走上了不同的道路。

这种分裂直接影响了 Python 生态：

1. 许多优秀的同步库没有异步版本，因为重写的成本太高
2. 新项目面临艰难的选择 —— 选择异步就意味着被限制在较小的生态圈里
3. 维护两套 API 的负担导致许多库作者直接放弃了异步支持
## 协程和线程的互相切换

## 在同步代码中调用异步函数

可以使用run_coroutine_threadsafe在同步代码中运行协程。它需要在另一个线程中的eventloop，然后在当前线程中调用run_coroutine_threadsafe，会将一个协程提交到另一个线程中的eventloop，在当前线程中会返回一个concurrent.futures.Future对象。

如果需要在当前线程中运行协程，可以直接asyncio.run(coro)，不过这样实际上是阻塞运行的，而且需要保证这个同步函数没有已经处于一个eventloop中（eventloop不能嵌套）。

使用asyncio.run_coroutine_threadsafe(coro, asyncio.get_running_loop()).result()这样的做法会导致死锁，因为result是一个同步操作，会阻塞事件循环，这个coro永远也不会被执行。

```text
Python
取消自动换行
复制
    # 获取事件循环
    loop = asyncio.get_event_loop()
    # 在事件循环中运行协程
    future = run_coroutine_threadsafe(async_operation(), loop)
    # 等待结果
    result = future.result()
    print(result)

# 在新线程中运行事件循环
def run_event_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_forever()

# 启动事件循环线程
loop_thread = threading.Thread(target=run_event_loop, daemon=True)
loop_thread.start()

# 在主线程中调用同步函数
sync_function()
```

## 在异步代码中执行同步函数

使用to_thread在协程中运行同步代码：

```text
Python
取消自动换行
复制
import asyncio
import time

def cpu_bound_operation(x):
    time.sleep(1)  # 模拟CPU密集操作
    return x * x

async def main():
    # 在线程池中执行同步函数
    result = await asyncio.to_thread(cpu_bound_operation, 123)
    print(result)

asyncio.run(main())
```

to_thread是asyncio.get_running_loop().run_in_executor的语法糖，使用run_in_executor可以自己

由于现在异步生态并不是特别完善，有大量的第三库只有同步版本的接口，所以to_thread是非常常用的

## 【生态】异步HTTP请求：aiohttp和httpx

http请求是最常见的io操作之一，aiohttp和httpx是两个常见的python 异步 http请求库，httpx对一些先进feature（例如http2）的支持更好，语法更接近常见的requests，但是aiohttp的高并发性能有显著优势（基于aiohttp=3.11.7和httpx=0.27.2版本）

【20241125】数据请求性能优化

```text
Python
取消自动换行
复制
import asyncio
import time
import aiohttp
from aiohttp import ClientSession
import httpx
from concurrent.futures import ProcessPoolExecutor
import statistics

ADDRESS = "https://www.baidu.com"

async def request_with_aiohttp(session):
    async with session.get(ADDRESS) as rsp:
        return await rsp.text()

async def request_with_httpx(client):
    rsp = await client.get(ADDRESS)
    return rsp.text

# 性能测试函数
async def benchmark_aiohttp(n):
    async with ClientSession() as session:
        start = time.time()
        tasks = []
        for i in range(n):
            tasks.append(request_with_aiohttp(session))
        await asyncio.gather(*tasks)
        return time.time() - start

async def benchmark_httpx(n):
    async with httpx.AsyncClient(
            timeout=httpx.Timeout(
                timeout=10,
            ),
        ) as client:
        start = time.time()
        tasks = []
        for i in range(n):
            tasks.append(request_with_httpx(client))
        await asyncio.gather(*tasks)
        return time.time() - start
```

```text
Python
取消自动换行
复制
开始测试 256 并发请求...

第 1 轮测试:
aiohttp 耗时: 0.29 秒
httpx 耗时: 1.16 秒

第 2 轮测试:
aiohttp 耗时: 0.26 秒
httpx 耗时: 1.23 秒

第 3 轮测试:
aiohttp 耗时: 0.32 秒
httpx 耗时: 1.26 秒

测试结果汇总:
aiohttp 平均耗时: 0.29 秒
httpx 平均耗时: 1.22 秒
```

## 【生态】高性能事件循环uvloop

uvloop 是一个用 Cython 编写的，基于 libuv 的 Python 事件循环替代品，它可以替代 Python 默认的 asyncio 事件循环，从而大幅提升异步代码的性能。

http://magic.io/blog/uvloop-blazing-fast-python-networking/ uvloop: Blazing fast Python networking As of this moment, uvloop is only available on *nix platforms and Python 3.5. uvloop is a drop-in replacement of the built-in asyncio event loop. You can install uvloop with pip: $ pip install uvloop

使用非常简单，将asyncio.run替换为uvloop.run即可。

在实际测试中，uvloop 通常能比 Python 默认的事件循环快 2-4 倍，有时甚至能达到 Node.js 的性能水平。这也是为什么很多高性能的 Python 异步框架，比如 FastAPI、Sanic 都默认使用 uvloop。

> 图片：飞书文档 - 图片

## 【生态】HTTP服务器：fastapi和uvicorn

FastAPI 是一个现代的 Python Web 框架，它最大的特点是通过类型提示（Type Hints）自动生成 API 文档和进行数据校验。开发者只需要定义好请求和响应的数据模型，FastAPI 就能自动处理参数验证、类型转换，并生成漂亮的 Swagger 文档。它基于 Starlette 构建，原生支持异步编程，性能表现接近 Node.js 和 Go。对开发者最友好的是它提供了极其优秀的 IDE 支持，代码补全和类型检查让开发效率大大提升。

Uvicorn 则是一个轻量级的 ASGI 服务器，它是 FastAPI 实际运行时依赖的服务器。它的特点是实现了 ASGI 协议，使用 uvloop 作为事件循环（比 Python 默认的 asyncio 更快），并用 httptools 来解析 HTTP 请求。在生产环境中，你可以配置多个 worker 进程来充分利用多核 CPU，还可以设置并发限制来防止服务器过载。

## 迁移现有同步代码至 asyncio

如果现有的应用是I/O 密集型的，且并发量较大，那么迁移到 asyncio 是最有收益的。

- 网络请求多
- 数据库操作频繁
- 文件操作频繁
迁移过程总结起来有如下一些关键点：

- 优先使用异步库替代同步库，如用 aiohttp 替代 requests
- 对于无法替代的同步代码，使用 asyncio.to_thread() 包装，而不是直接调用。
- 采用渐进式迁移策略：先迁移 I/O 密集型操作，保留必要的线程用于系统调用或 CPU 密集任务。
- 使用 EventLoopBlockingDetector 监控同步阻塞代码（一旦出现，可能会导致迁移到异步后性能反而剧烈下降）

## 总结

- asyncio 相比多线程，提供更优雅的并发控制、支持安全的任务取消、资源占用更低。如果你的应用有大量并发的IO操作，那么最适合迁移为异步执行。
- asyncio 使用时需要避免在协程中直接调用阻塞操作，需要用工具完全消灭任何同步阻塞代码。
- 正确处理异常和取消：通常无需显式捕获 CancelledError，使用 with 或者 async with 自动管理资源
- 迁移： 优先使用异步库替代同步库，对于无法替代的同步代码，使用 asyncio.to_thread() 包装，避免在任何协程中直接调用同步代码。
