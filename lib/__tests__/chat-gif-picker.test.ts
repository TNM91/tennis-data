import {afterEach,describe,it,expect,vi} from 'vitest'
import {chooseChatGif,gifFileData} from '../../mobile/src/chat-gifs'
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
describe('original GIF file picker lifecycle',()=>{
 it('rejects an oversized or fake GIF before creating an image decoder',async()=>{
  const image=vi.fn();vi.stubGlobal('Image',image)
  await expect(gifFileData({size:2097153,arrayBuffer:async()=>new ArrayBuffer(0)})).rejects.toThrow('2 MB')
  await expect(gifFileData({size:20,arrayBuffer:async()=>new Uint8Array(20).buffer})).rejects.toThrow('GIF');expect(image).not.toHaveBeenCalled()
 })
 it('cleans up canceled, aborted and timed-out choosers without leaving the draft blocked',async()=>{
  vi.useFakeTimers();const inputs:{oncancel?:()=>void;remove:ReturnType<typeof vi.fn>;click:ReturnType<typeof vi.fn>;setAttribute:ReturnType<typeof vi.fn>}[]=[]
  vi.stubGlobal('document',{body:{append:vi.fn()},createElement:()=>{const input={remove:vi.fn(),click:vi.fn(),setAttribute:vi.fn()};inputs.push(input);return input}})
  vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()})
  const canceled=chooseChatGif(new AbortController().signal);const canceledResult=expect(canceled).rejects.toThrow('No GIF');inputs[0].oncancel?.();await canceledResult;expect(inputs[0].remove).toHaveBeenCalledTimes(1)
  const controller=new AbortController(),aborted=chooseChatGif(controller.signal),abortedResult=expect(aborted).rejects.toThrow('No GIF');controller.abort();await abortedResult;expect(inputs[1].remove).toHaveBeenCalledTimes(1)
  const timeout=chooseChatGif(new AbortController().signal),timeoutResult=expect(timeout).rejects.toThrow('No GIF');await vi.advanceTimersByTimeAsync(120000);await timeoutResult;expect(inputs[2].remove).toHaveBeenCalledTimes(1)
 })
})
