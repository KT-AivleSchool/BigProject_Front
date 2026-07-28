import os

components = [
    ("Step1DataInput", "데이터 업로드 (Drag & Drop)"),
    ("Step2AuditHITL", "AI 감리 및 1차 HITL 검증"),
    ("Step3Weighting", "가중치 산출 및 2차 HITL 검증"),
    ("Step4LocationMap", "위치 선정 및 지도 시각화 (Vworld)"),
    ("Step5PersonaDebate", "AI 페르소나 토론 및 갈등 시뮬레이션"),
    ("Step6Report", "최종 분석 결과 리포트 출력")
]

base_dir = "/Users/jcm0314/Downloads/빅프로젝트/frontend/src/components/pipeline"

for comp, desc in components:
    content = f"""import React from 'react';
import {{ Card, CardContent, CardHeader, CardTitle }} from '@/components/ui/card';
import {{ Button }} from '@/components/ui/button';
import {{ usePipelineStore }} from '@/store/usePipelineStore';

export default function {comp}() {{
  const {{ currentStep, setCurrentStep }} = usePipelineStore();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step {{currentStep}}: {desc}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400">
            {desc} UI가 여기에 구현될 예정입니다.
          </div>
          
          <div className="mt-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={{() => setCurrentStep(Math.max(1, currentStep - 1))}}
              disabled={{currentStep === 1}}
            >
              이전 단계
            </Button>
            <Button 
              onClick={{() => setCurrentStep(Math.min(6, currentStep + 1))}}
              disabled={{currentStep === 6}}
            >
              다음 단계
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}}
"""
    with open(os.path.join(base_dir, f"{comp}.jsx"), "w") as f:
        f.write(content)

print("Dummy components generated successfully.")
