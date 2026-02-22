import { useCallback } from 'react'
import settingsStore from '@/features/stores/settings'
import { defaultModels } from '@/features/constants/aiModels'
import { AIService } from '@/features/constants/settings'

export const useAIServiceHandlers = () => {
  const handleAIServiceChange = useCallback((newService: AIService) => {
    const selectedModel = defaultModels[newService]

    settingsStore.setState({
      selectAIService: newService,
      selectAIModel: selectedModel,
    })
  }, [])

  return {
    handleAIServiceChange,
  }
}
