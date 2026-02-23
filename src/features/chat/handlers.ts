import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { EmotionType } from '@/features/messages/messages'
import { speakCharacter } from '@/features/messages/speakCharacter'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import webSocketStore from '@/features/stores/websocketStore'
import i18next from 'i18next'
import toastStore from '@/features/stores/toast'
import { generateMessageId } from '@/utils/messageUtils'
import { isCameraSupported } from '@/components/cameraPreview'

/**
 * ストリーミング完了後に表情をニュートラルに戻す
 * @param delayMs 遅延時間（ミリ秒）
 */
const resetExpressionAfterDelay = (delayMs: number = 3000) => {
  setTimeout(() => {
    const viewer = homeStore.getState().viewer
    viewer?.model?.playEmotion('neutral')
  }, delayMs)
}

// ジェスチャータグの種類
type GestureTag = 'bow' | 'present'

/**
 * ジェスチャータグを検出してジェスチャーをトリガーする
 * @param text テキスト
 * @param triggeredGestures 既にトリガー済みのジェスチャー（重複防止用）
 */
const detectAndTriggerGestures = (
  text: string,
  triggeredGestures: Set<GestureTag>
) => {
  const viewer = homeStore.getState().viewer
  if (!viewer?.model) return

  const gestureTags: GestureTag[] = ['bow', 'present']

  for (const gesture of gestureTags) {
    if (!triggeredGestures.has(gesture) && text.includes(`[${gesture}]`)) {
      viewer.model.playGesture(gesture)
      triggeredGestures.add(gesture)
      // 1つのジェスチャーをトリガーしたら次のチャンクを待つ
      break
    }
  }
}

/**
 * ジェスチャータグとカメラタグをテキストから除去する
 * @param text 入力テキスト
 * @returns タグを除去したテキスト
 */
const removeGestureTags = (text: string): string => {
  return text.replace(/\[(bow|present|camera)\]/g, '')
}

// セッションIDを生成する関数
const generateSessionId = () => generateMessageId()

// コードブロックのデリミネーター
const CODE_DELIMITER = '```'

/**
 * テキストから感情タグ `[...]` を抽出する（有効な感情タグのみ）
 * @param text 入力テキスト
 * @returns 感情タグと残りのテキスト
 */
const extractEmotion = (
  text: string
): { emotionTag: string; remainingText: string } => {
  // 有効な感情タグのみマッチする（ジェスチャーやリンク等の他タグを誤認識しない）
  const emotionMatch = text.match(
    /^\s*\[(neutral|happy|angry|sad|relaxed|surprised)\]/
  )
  if (emotionMatch?.[0]) {
    return {
      emotionTag: emotionMatch[0].trim(), // タグ自体の前後のスペースは除去
      // 先頭のスペースも含めて削除し、さらに前後のスペースを除去
      remainingText: text
        .slice(text.indexOf(emotionMatch[0]) + emotionMatch[0].length)
        .trimStart(),
    }
  }
  return { emotionTag: '', remainingText: text }
}

/**
 * テキストから文法的に区切りの良い文を抽出する
 * @param text 入力テキスト
 * @returns 抽出された文と残りのテキスト
 */
const extractSentence = (
  text: string
): { sentence: string; remainingText: string } => {
  const sentenceMatch = text.match(
    /^(.{1,19}?(?:[。．.!?！？\n]|(?=\[))|.{20,}?(?:[、,。．.!?！？\n]|(?=\[)))/
  )
  if (sentenceMatch?.[0]) {
    return {
      sentence: sentenceMatch[0],
      remainingText: text.slice(sentenceMatch[0].length).trimStart(),
    }
  }
  return { sentence: '', remainingText: text }
}

/**
 * 発話と関連する状態更新を行う
 * @param sessionId セッションID
 * @param sentence 発話する文
 * @param emotionTag 感情タグ (例: "[neutral]")
 * @param currentAssistantMessageListRef アシスタントメッセージリストの参照
 * @param fallbackEmotion 感情タグがない場合に使用するフォールバック感情
 */
const handleSpeakAndStateUpdate = (
  sessionId: string,
  sentence: string,
  emotionTag: string,
  currentAssistantMessageListRef: { current: string[] },
  fallbackEmotion: EmotionType = 'neutral'
) => {
  const hs = homeStore.getState()
  const emotion = emotionTag.includes('[')
    ? (emotionTag.slice(1, -1).toLowerCase() as EmotionType)
    : fallbackEmotion

  // 発話不要/不可能な文字列だった場合はスキップ
  if (
    sentence === '' ||
    sentence.replace(
      /^[\s\u3000\t\n\r\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]'"''""・、。,.!?！？:：;；\-_=+~～*＊@＠#＃$＄%％^＾&＆|｜\\＼/／`｀]+$/gu,
      ''
    ) === ''
  ) {
    return
  }

  speakCharacter(
    sessionId,
    { message: sentence, emotion: emotion },
    () => {
      hs.incrementChatProcessingCount()
    },
    () => {
      hs.decrementChatProcessingCount()
    }
  )
}

/**
 * 受け取ったメッセージを処理し、AIの応答を生成して発話させる (Refactored)
 * @param receivedMessage 処理する文字列
 */
export const speakMessageHandler = async (receivedMessage: string) => {
  const sessionId = generateSessionId()
  const assistantMessageListRef = { current: [] as string[] }

  let isCodeBlock: boolean = false
  let codeBlockContent: string = ''
  let accumulatedAssistantText: string = ''
  // ジェスチャータグとリンクタグを発話テキストから除去
  let remainingMessage = receivedMessage
    .replace(/\[(bow|present|camera)\]/g, '')
    .replace(/\[link:[^\]]*\](.*?)\[\/link\]/g, '$1')
  let currentMessageId: string = generateMessageId()
  let persistentEmotion: EmotionType = 'neutral' // レスポンス全体で保持する感情

  while (remainingMessage.length > 0 || isCodeBlock) {
    let processableText = ''
    let currentCodeBlock = ''

    if (isCodeBlock) {
      if (remainingMessage.includes(CODE_DELIMITER)) {
        const [codeEnd, ...rest] = remainingMessage.split(CODE_DELIMITER)
        currentCodeBlock = codeBlockContent + codeEnd
        codeBlockContent = ''
        remainingMessage = rest.join(CODE_DELIMITER).trimStart()
        isCodeBlock = false

        if (accumulatedAssistantText.trim()) {
          homeStore.getState().upsertMessage({
            id: currentMessageId,
            role: 'assistant',
            content: accumulatedAssistantText.trim(),
          })
          accumulatedAssistantText = ''
        }
        const codeBlockId = generateMessageId()
        homeStore.getState().upsertMessage({
          id: codeBlockId,
          role: 'code',
          content: currentCodeBlock,
        })

        currentMessageId = generateMessageId()
        continue
      } else {
        codeBlockContent += remainingMessage
        remainingMessage = ''
        continue
      }
    } else if (remainingMessage.includes(CODE_DELIMITER)) {
      const [beforeCode, ...rest] = remainingMessage.split(CODE_DELIMITER)
      processableText = beforeCode
      codeBlockContent = rest.join(CODE_DELIMITER)
      isCodeBlock = true
      remainingMessage = ''
    } else {
      processableText = remainingMessage
      remainingMessage = ''
    }

    if (processableText.length > 0) {
      let localRemaining = processableText.trimStart()
      while (localRemaining.length > 0) {
        const prevLocalRemaining = localRemaining
        const { emotionTag, remainingText: textAfterEmotion } =
          extractEmotion(localRemaining)
        const { sentence, remainingText: textAfterSentence } =
          extractSentence(textAfterEmotion)

        if (sentence) {
          // 新しい感情タグがあれば永続感情を更新
          if (emotionTag.includes('[')) {
            persistentEmotion = emotionTag
              .slice(1, -1)
              .toLowerCase() as EmotionType
          }
          assistantMessageListRef.current.push(sentence)
          const aiText = emotionTag ? `${emotionTag} ${sentence}` : sentence
          accumulatedAssistantText += aiText + ' '
          handleSpeakAndStateUpdate(
            sessionId,
            sentence,
            emotionTag,
            assistantMessageListRef,
            persistentEmotion
          )
          localRemaining = textAfterSentence
        } else {
          if (localRemaining === prevLocalRemaining && localRemaining) {
            // 新しい感情タグがあれば永続感情を更新
            if (emotionTag.includes('[')) {
              persistentEmotion = emotionTag
                .slice(1, -1)
                .toLowerCase() as EmotionType
            }
            const finalSentence = localRemaining
            assistantMessageListRef.current.push(finalSentence)
            const aiText = emotionTag
              ? `${emotionTag} ${finalSentence}`
              : finalSentence
            accumulatedAssistantText += aiText + ' '
            handleSpeakAndStateUpdate(
              sessionId,
              finalSentence,
              emotionTag,
              assistantMessageListRef,
              persistentEmotion
            )
            localRemaining = ''
          } else {
            localRemaining = textAfterSentence
          }
        }
        if (
          localRemaining.length > 0 &&
          localRemaining === prevLocalRemaining &&
          !sentence
        ) {
          console.warn(
            'Potential infinite loop detected in speakMessageHandler, breaking. Remaining:',
            localRemaining
          )
          const finalSentence = localRemaining
          assistantMessageListRef.current.push(finalSentence)
          accumulatedAssistantText += finalSentence + ' '
          handleSpeakAndStateUpdate(
            sessionId,
            finalSentence,
            '',
            assistantMessageListRef,
            persistentEmotion
          )
          break
        }
      }
    }

    if (isCodeBlock && codeBlockContent) {
      if (accumulatedAssistantText.trim()) {
        homeStore.getState().upsertMessage({
          id: currentMessageId,
          role: 'assistant',
          content: accumulatedAssistantText.trim(),
        })
        accumulatedAssistantText = ''
      }
      remainingMessage = codeBlockContent
      codeBlockContent = ''
    }
  }

  if (accumulatedAssistantText.trim()) {
    homeStore.getState().upsertMessage({
      id: currentMessageId,
      role: 'assistant',
      content: accumulatedAssistantText.trim(),
    })
  }
  if (isCodeBlock && codeBlockContent.trim()) {
    console.warn('Loop ended unexpectedly while in code block state.')
    homeStore.getState().upsertMessage({
      role: 'code',
      content: codeBlockContent.trim(),
    })
  }
}

/**
 * カメラから1フレームをキャプチャしてbase64データURLを返す。
 * CameraPreview UIを開かず、直接getUserMediaでストリームを取得する。
 */
const captureOneFrame = async (): Promise<string | null> => {
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.playsInline = true
    video.muted = true

    // メタデータ読み込みを待ってから再生（videoWidth/heightを確定させる）
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve()
    })
    await video.play()

    // フレームが安定するまで少し待つ
    await new Promise((r) => setTimeout(r, 300))

    const vw = video.videoWidth
    const vh = video.videoHeight
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1024 / Math.max(vw, vh))
    canvas.width = vw * scale
    canvas.height = vh * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/jpeg', 0.85)
  } catch (e) {
    console.error('captureOneFrame failed:', e)
    return null
  } finally {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
  }
}

/**
 * [camera]タグ検出後の自動キャプチャと送信を処理する
 */
const handleAutoCaptureAndSend = async () => {
  const ss = settingsStore.getState()
  if (!ss.enableAutoCapture) return

  if (!isCameraSupported()) {
    await processAIResponse(
      '[system: カメラが利用できない環境です。テキストのみで会話を続けてください。]'
    )
    return
  }

  homeStore.setState({ chatProcessing: true })

  try {
    const dataUrl = await captureOneFrame()

    if (!dataUrl) {
      homeStore.setState({ chatProcessing: false })
      await processAIResponse(
        '[system: 撮影に失敗しました。テキストのみで会話を続けてください。]'
      )
      return
    }

    const base64 = extractBase64FromDataUrl(dataUrl)

    toastStore.getState().addToast({
      message: i18next.t('AutoCaptureComplete'),
      type: 'info',
      tag: 'auto-capture',
    })

    homeStore.getState().upsertMessage({
      role: 'user',
      content: [
        { type: 'text', text: '' },
        { type: 'image', image: dataUrl },
      ],
      timestamp: new Date().toISOString(),
    })

    await processAIResponse('[自動撮影した画像です]', base64)
  } catch (e) {
    console.error('Auto-capture failed:', e)
    homeStore.setState({ chatProcessing: false })
  }
}

/**
 * AIからの応答を処理する関数
 * 会話履歴はAgentCore Memoryが管理するため、最新のユーザーメッセージのみ送信
 * @param userMessage ユーザーのメッセージ
 */
export const processAIResponse = async (
  userMessage: string,
  imageBase64?: string
) => {
  const sessionId = generateSessionId()
  homeStore.setState({ chatProcessing: true })
  let stream

  const assistantMessageListRef = { current: [] as string[] }

  try {
    stream = await getAIChatResponseStream(userMessage, imageBase64)
  } catch (e) {
    console.error(e)
    toastStore.getState().addToast({
      message: i18next.t('Errors.AIAPIError'),
      type: 'error',
      tag: 'ai-api-error',
    })
    homeStore.setState({ chatProcessing: false })
    return
  }

  if (stream == null) {
    homeStore.setState({ chatProcessing: false })
    return
  }

  const reader = stream.getReader()
  let receivedChunksForSpeech = ''
  let currentMessageId: string | null = null
  let currentMessageContent = ''
  let currentEmotionTag = ''
  let persistentEmotion: EmotionType = 'neutral' // レスポンス全体で保持する感情
  let isCodeBlock = false
  let codeBlockContent = ''
  const triggeredGestures = new Set<GestureTag>() // トリガー済みジェスチャーを追跡
  let cameraTagDetected = false

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        let textToAdd = value

        if (!isCodeBlock) {
          const delimiterIndexInValue = value.indexOf(CODE_DELIMITER)
          if (delimiterIndexInValue !== -1) {
            textToAdd = value.substring(0, delimiterIndexInValue)
          }
        }

        if (currentMessageId === null) {
          currentMessageId = generateMessageId()
          currentMessageContent = textToAdd
          if (currentMessageContent) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: removeGestureTags(currentMessageContent),
            })
          }
        } else if (!isCodeBlock) {
          currentMessageContent += textToAdd

          if (textToAdd) {
            homeStore.getState().upsertMessage({
              id: currentMessageId,
              role: 'assistant',
              content: removeGestureTags(currentMessageContent),
            })
          }
        }

        receivedChunksForSpeech += value

        // [camera]タグを検出して除去（発話テキストから除外）
        if (receivedChunksForSpeech.includes('[camera]')) {
          cameraTagDetected = true
          receivedChunksForSpeech = receivedChunksForSpeech.replace(
            /\[camera\]/g,
            ''
          )
        }

        // ジェスチャータグを検出してトリガー
        detectAndTriggerGestures(receivedChunksForSpeech, triggeredGestures)

        // ジェスチャータグとリンクタグを発話テキストから除去
        // （TTSが「bow」「present」等をテキストとして読み上げるのを防止）
        receivedChunksForSpeech = receivedChunksForSpeech
          .replace(/\[(bow|present)\]/g, '')
          .replace(/\[link:[^\]]*\](.*?)\[\/link\]/g, '$1')
      }

      let processableTextForSpeech = receivedChunksForSpeech
      receivedChunksForSpeech = ''

      while (processableTextForSpeech.length > 0) {
        const originalProcessableText = processableTextForSpeech

        if (isCodeBlock) {
          codeBlockContent += processableTextForSpeech
          processableTextForSpeech = ''

          const delimiterIndex = codeBlockContent.lastIndexOf(CODE_DELIMITER)

          if (
            delimiterIndex !== -1 &&
            delimiterIndex >=
              codeBlockContent.length -
                (originalProcessableText.length + CODE_DELIMITER.length - 1)
          ) {
            const actualCode = codeBlockContent.substring(0, delimiterIndex)
            const remainingAfterDelimiter = codeBlockContent.substring(
              delimiterIndex + CODE_DELIMITER.length
            )

            if (actualCode.trim()) {
              homeStore.getState().upsertMessage({
                role: 'code',
                content: actualCode,
              })
            }

            codeBlockContent = ''
            isCodeBlock = false
            currentEmotionTag = ''

            currentMessageId = generateMessageId()
            currentMessageContent = ''

            processableTextForSpeech = remainingAfterDelimiter.trimStart()
            continue
          } else {
            receivedChunksForSpeech = codeBlockContent + receivedChunksForSpeech
            codeBlockContent = ''
            break
          }
        } else {
          const delimiterIndex =
            processableTextForSpeech.indexOf(CODE_DELIMITER)
          if (delimiterIndex !== -1) {
            const beforeCode = processableTextForSpeech.substring(
              0,
              delimiterIndex
            )
            const afterDelimiterRaw = processableTextForSpeech.substring(
              delimiterIndex + CODE_DELIMITER.length
            )

            let textToProcessBeforeCode = beforeCode.trimStart()
            while (textToProcessBeforeCode.length > 0) {
              const prevText = textToProcessBeforeCode
              const {
                emotionTag: extractedEmotion,
                remainingText: textAfterEmotion,
              } = extractEmotion(textToProcessBeforeCode)
              if (extractedEmotion) currentEmotionTag = extractedEmotion
              const { sentence, remainingText: textAfterSentence } =
                extractSentence(textAfterEmotion)

              if (sentence) {
                // 新しい感情タグがあれば永続感情を更新
                if (currentEmotionTag.includes('[')) {
                  persistentEmotion = currentEmotionTag
                    .slice(1, -1)
                    .toLowerCase() as EmotionType
                }
                handleSpeakAndStateUpdate(
                  sessionId,
                  sentence,
                  currentEmotionTag,
                  assistantMessageListRef,
                  persistentEmotion
                )
                textToProcessBeforeCode = textAfterSentence
                if (!textAfterSentence) currentEmotionTag = ''
              } else {
                receivedChunksForSpeech =
                  textToProcessBeforeCode + receivedChunksForSpeech
                textToProcessBeforeCode = ''
                break
              }

              if (
                textToProcessBeforeCode.length > 0 &&
                textToProcessBeforeCode === prevText
              ) {
                console.warn('Speech processing loop stuck on:', prevText)
                receivedChunksForSpeech =
                  textToProcessBeforeCode + receivedChunksForSpeech
                break
              }
            }

            isCodeBlock = true
            codeBlockContent = ''

            const langMatch = afterDelimiterRaw.match(/^ *(\w+)? *\n/)
            let remainingAfterDelimiter = afterDelimiterRaw
            if (langMatch) {
              remainingAfterDelimiter = afterDelimiterRaw.substring(
                langMatch[0].length
              )
            }
            processableTextForSpeech = remainingAfterDelimiter
            continue
          } else {
            const {
              emotionTag: extractedEmotion,
              remainingText: textAfterEmotion,
            } = extractEmotion(processableTextForSpeech)
            if (extractedEmotion) currentEmotionTag = extractedEmotion

            const { sentence, remainingText: textAfterSentence } =
              extractSentence(textAfterEmotion)

            if (sentence) {
              // 新しい感情タグがあれば永続感情を更新
              if (currentEmotionTag.includes('[')) {
                persistentEmotion = currentEmotionTag
                  .slice(1, -1)
                  .toLowerCase() as EmotionType
              }
              handleSpeakAndStateUpdate(
                sessionId,
                sentence,
                currentEmotionTag,
                assistantMessageListRef,
                persistentEmotion
              )
              processableTextForSpeech = textAfterSentence
              if (!textAfterSentence) currentEmotionTag = ''
            } else {
              receivedChunksForSpeech =
                processableTextForSpeech + receivedChunksForSpeech
              processableTextForSpeech = ''
              break
            }
          }
        }

        if (
          processableTextForSpeech.length > 0 &&
          processableTextForSpeech === originalProcessableText
        ) {
          console.warn(
            'Main speech processing loop stuck on:',
            originalProcessableText
          )
          receivedChunksForSpeech =
            processableTextForSpeech + receivedChunksForSpeech
          processableTextForSpeech = ''
          break
        }
      }

      if (done) {
        if (receivedChunksForSpeech.length > 0) {
          if (!isCodeBlock) {
            const finalSentence = receivedChunksForSpeech
            const { emotionTag: extractedEmotion, remainingText: finalText } =
              extractEmotion(finalSentence)
            if (extractedEmotion) {
              currentEmotionTag = extractedEmotion
              persistentEmotion = extractedEmotion
                .slice(1, -1)
                .toLowerCase() as EmotionType
            }

            handleSpeakAndStateUpdate(
              sessionId,
              finalText,
              currentEmotionTag,
              assistantMessageListRef,
              persistentEmotion
            )
          } else {
            console.warn(
              'Stream ended while still in code block state. Saving remaining code.',
              codeBlockContent
            )
            codeBlockContent += receivedChunksForSpeech
            if (codeBlockContent.trim()) {
              homeStore.getState().upsertMessage({
                role: 'code',
                content: codeBlockContent,
              })
            }
            codeBlockContent = ''
            isCodeBlock = false
          }
        }

        if (isCodeBlock && codeBlockContent.trim()) {
          console.warn(
            'Stream ended unexpectedly while in code block state. Saving buffered code.'
          )
          homeStore.getState().upsertMessage({
            role: 'code',
            content: codeBlockContent,
          })
          codeBlockContent = ''
          isCodeBlock = false
        }
        break
      }
    }
  } catch (e) {
    console.error('Error processing AI response stream:', e)
    toastStore.getState().addToast({
      message: i18next.t('Errors.AIAPIError'),
      type: 'error',
      tag: 'ai-stream-error',
    })
  } finally {
    reader.releaseLock()
  }

  homeStore.setState({
    chatProcessing: false,
  })

  // ストリーミング完了後に表情をニュートラルに戻す
  resetExpressionAfterDelay()

  if (currentMessageContent.trim()) {
    homeStore.getState().upsertMessage({
      id: currentMessageId ?? generateMessageId(),
      role: 'assistant',
      content: removeGestureTags(currentMessageContent.trim()),
    })
  }
  if (isCodeBlock && codeBlockContent.trim()) {
    console.warn(
      'Stream ended unexpectedly while in code block state. Saving buffered code.'
    )
    homeStore.getState().upsertMessage({
      role: 'code',
      content: codeBlockContent,
    })
  }

  // [camera]タグが検出された場合、自動キャプチャを実行
  // 画像分析リクエスト（imageBase64あり）からの再帰呼び出しでは実行しない
  if (cameraTagDetected && !imageBase64) {
    await handleAutoCaptureAndSend()
  }
}

/**
 * アシスタントとの会話を行う
 * 画面のチャット欄から入力されたときに実行される処理
 */
/**
 * data URLからbase64データ部分を抽出する
 */
const extractBase64FromDataUrl = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl
}

export const handleSendChatFn = () => async (text: string) => {
  const newMessage = text
  const timestamp = new Date().toISOString()

  if (newMessage === null) return

  const ss = settingsStore.getState()
  const wsManager = webSocketStore.getState().wsManager

  // 画像データを取得してクリア
  const modalImage = homeStore.getState().modalImage
  const imageBase64 = modalImage
    ? extractBase64FromDataUrl(modalImage)
    : undefined
  if (modalImage) {
    homeStore.setState({ modalImage: '' })
  }

  if (ss.externalLinkageMode) {
    homeStore.setState({ chatProcessing: true })

    if (wsManager?.websocket?.readyState === WebSocket.OPEN) {
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp: timestamp,
      })

      wsManager.websocket.send(
        JSON.stringify({ content: newMessage, type: 'chat' })
      )
    } else {
      toastStore.getState().addToast({
        message: i18next.t('NotConnectedToExternalAssistant'),
        type: 'error',
        tag: 'not-connected-to-external-assistant',
      })
      homeStore.setState({
        chatProcessing: false,
      })
    }
  } else {
    homeStore.setState({ chatProcessing: true })

    // ユーザーメッセージをチャットログに追加（画面表示用）
    if (modalImage) {
      // 画像付きメッセージ: マルチモーダル形式で保存
      homeStore.getState().upsertMessage({
        role: 'user',
        content: [
          { type: 'text', text: newMessage || '' },
          { type: 'image', image: modalImage },
        ],
        timestamp: timestamp,
      })
    } else {
      homeStore.getState().upsertMessage({
        role: 'user',
        content: newMessage,
        timestamp: timestamp,
      })
    }

    try {
      // 会話履歴はAgentCore Memoryが管理するため、最新のユーザーメッセージのみ送信
      await processAIResponse(newMessage, imageBase64)
    } catch (e) {
      console.error(e)
      toastStore.getState().addToast({
        message: i18next.t('Errors.AIAPIError'),
        type: 'error',
        tag: 'ai-response-error',
      })
      homeStore.setState({ chatProcessing: false })
    }
  }
}

/**
 * WebSocketからのテキストを受信したときの処理
 */
export const handleReceiveTextFromWsFn =
  () =>
  async (
    text: string,
    role?: string,
    emotion: EmotionType = 'neutral',
    type?: string
  ) => {
    const sessionId = generateSessionId()
    if (text === null || role === undefined) return

    const ss = settingsStore.getState()
    const hs = homeStore.getState()
    const wsManager = webSocketStore.getState().wsManager

    if (ss.externalLinkageMode) {
      console.log('ExternalLinkage Mode: true')
    } else {
      console.log('ExternalLinkage Mode: false')
      return
    }

    homeStore.setState({ chatProcessing: true })

    if (role !== 'user') {
      if (type === 'start') {
        // startの場合は何もしない（textは空文字のため）
        console.log('Starting new response')
        wsManager?.setTextBlockStarted(false)
      } else if (
        hs.chatLog.length > 0 &&
        hs.chatLog[hs.chatLog.length - 1].role === role &&
        wsManager?.textBlockStarted
      ) {
        // 既存のメッセージに追加（IDを維持）
        const lastMessage = hs.chatLog[hs.chatLog.length - 1]
        const lastContent =
          typeof lastMessage.content === 'string' ? lastMessage.content : ''

        homeStore.getState().upsertMessage({
          id: lastMessage.id,
          role: role,
          content: lastContent + text,
        })
      } else {
        // 新しいメッセージを追加（新規IDを生成）
        homeStore.getState().upsertMessage({
          role: role,
          content: text,
        })
        wsManager?.setTextBlockStarted(true)
      }

      if (role === 'assistant' && text !== '') {
        try {
          // 文ごとに音声を生成 & 再生、返答を表示
          speakCharacter(
            sessionId,
            {
              message: text,
              emotion: emotion,
            },
            () => {
              // assistantMessage is now derived from chatLog, no need to set it separately
            },
            () => {
              // hs.decrementChatProcessingCount()
            }
          )
        } catch (e) {
          console.error('Error in speakCharacter:', e)
        }
      }

      if (type === 'end') {
        // レスポンスの終了処理
        console.log('Response ended')
        wsManager?.setTextBlockStarted(false)
        homeStore.setState({ chatProcessing: false })
      }
    }

    homeStore.setState({ chatProcessing: type !== 'end' })
  }
