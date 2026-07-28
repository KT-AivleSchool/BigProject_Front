'use client'

import React from 'react';
import { usePipelineStore } from '@/store/usePipelineStore';

import Step1DataInput from '@/components/pipeline/Step1DataInput';
import Step2AuditHITL from '@/components/pipeline/Step2AuditHITL';
import Step3Weighting from '@/components/pipeline/Step3Weighting';
import Step4LocationMap from '@/components/pipeline/Step4LocationMap';
import Step5PersonaDebate from '@/components/pipeline/Step5PersonaDebate';
import Step6Report from '@/components/pipeline/Step6Report';

export default function DashboardPage() {
  const { currentStep } = usePipelineStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1DataInput />;
      case 2: return <Step2AuditHITL />;
      case 3: return <Step3Weighting />;
      case 4: return <Step4LocationMap />;
      case 5: return <Step5PersonaDebate />;
      case 6: return <Step6Report />;
      default: return <Step1DataInput />;
    }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {renderStep()}
    </div>
  );
}
