import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePipelineStore } from '@/store/usePipelineStore';

export default function Step5PersonaDebate() {
  const { currentStep, setCurrentStep } = usePipelineStore();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step {currentStep}: AI 페르소나 토론 및 갈등 시뮬레이션</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400">
            AI 페르소나 토론 및 갈등 시뮬레이션 UI가 여기에 구현될 예정입니다.
          </div>
          
          <div className="mt-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              이전 단계
            </Button>
            <Button 
              onClick={() => setCurrentStep(Math.min(6, currentStep + 1))}
              disabled={currentStep === 6}
            >
              다음 단계
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
