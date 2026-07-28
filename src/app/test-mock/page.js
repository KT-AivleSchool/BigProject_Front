'use client'

import { useEffect, useState } from 'react'
import { usePipelineStore } from '@/store/usePipelineStore'

export default function TestMockPage() {
  const { sessionId, pipelineState, setPipelineState } = usePipelineStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchMockState() {
      try {
        setLoading(true)
        setError(null)
        
        // 3회 재시도(Retry) 로직
        let attempt = 0;
        let response = null;
        
        while (attempt < 3) {
          try {
            response = await fetch(`http://localhost:8000/api/v1/pipeline/state/${sessionId}`)
            if (response.ok) break;
          } catch (err) {
            console.error(`Fetch attempt ${attempt + 1} failed`, err)
          }
          attempt++;
          if (attempt < 3) await new Promise(res => setTimeout(res, 1000)); // 1초 대기 후 재시도
        }

        if (!response || !response.ok) {
          throw new Error('백엔드 서버 통신에 실패했습니다. (Hard Fail)')
        }

        const data = await response.json()
        setPipelineState(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchMockState()
    }
  }, [sessionId, setPipelineState])

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">GAM2 파이프라인 연동 테스트 (Mock API)</h1>
      
      <div className="mb-4 flex items-center gap-4">
        <span className="font-semibold">현재 세션 ID:</span>
        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{sessionId}</span>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-6">
        <h2 className="text-xl font-bold mb-4">서버 응답 상태 (Zustand Local Storage)</h2>
        
        {loading && (
          <div className="flex items-center gap-3 text-blue-600">
            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
            데이터를 불러오는 중입니다...
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && pipelineState && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-green-600">✅ 백엔드 연동 성공!</span>
              <span className="text-sm text-gray-500">Step: {pipelineState.current_step}</span>
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
              {JSON.stringify(pipelineState, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
