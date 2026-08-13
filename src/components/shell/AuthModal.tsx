"use client";

import React, { useState, useEffect } from "react";
import { postJson, ApiError } from "@/lib/omnisite/client";
import { UserLogin, UserRegister, TokenResponse, UserResponse, setAuthToken, setRefreshToken, setAuthUser } from "@/lib/omnisite/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserResponse) => void;
  initialMode?: "login" | "register";
}

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [username, setUsername] = useState("");

  // Terms states
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  // Chunk 1: 이메일 중복 체크 & 비밀번호 실시간 유효성 상태
  const [emailStatus, setEmailStatus] = useState<{ checked: boolean; available: boolean; message: string }>({
    checked: false,
    available: false,
    message: "",
  });
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<{ valid: boolean; message: string }>({
    valid: false,
    message: "",
  });

  // 요구사항 3: 모달 열림/닫힘 및 mode 변경 시 UI 탭 및 폼 상태 리셋
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setRegisterStep(1);
      setError(null);
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setUsername("");
      setAgreeAll(false);
      setAgreeTerms(false);
      setAgreePrivacy(false);
      setAgreeMarketing(false);
      setEmailStatus({ checked: false, available: false, message: "" });
      setPasswordValidation({ valid: false, message: "" });
    }
  }, [isOpen, initialMode]);

  // 요구사항 1: 비밀번호 실시간 유효성 검증 함수
  const validatePasswordInput = (pwd: string) => {
    if (!pwd) return { valid: false, message: "" };
    const hasMinLen = pwd.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*]/.test(pwd);

    if (hasMinLen && hasLetter && hasNumber && hasSpecial) {
      return { valid: true, message: "✓ 사용 가능한 비밀번호입니다." };
    }

    const missing = [];
    if (!hasMinLen) missing.push("8자 이상");
    if (!hasLetter) missing.push("영문");
    if (!hasNumber) missing.push("숫자");
    if (!hasSpecial) missing.push("특수문자(!@#$%^&*)");

    return { valid: false, message: `비밀번호 조건: ${missing.join(", ")} 포함 필요` };
  };

  useEffect(() => {
    if (mode === "register") {
      setPasswordValidation(validatePasswordInput(password));
    }
  }, [password, mode]);

  // 요구사항 2: 이메일 실시간 중복 확인 (400ms 디바운스)
  useEffect(() => {
    if (mode !== "register" || registerStep !== 2 || !email || !email.includes("@")) {
      setEmailStatus({ checked: false, available: false, message: "" });
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingEmail(true);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/auth/check-email?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.available) {
            setEmailStatus({ checked: true, available: true, message: "✓ 사용 가능한 행정 이메일입니다." });
          } else {
            setEmailStatus({ checked: true, available: false, message: "❌ 이미 등록된 행정 이메일입니다." });
          }
        } else {
          setEmailStatus({ checked: false, available: false, message: "이메일 확인 중 오류가 발생했습니다." });
        }
      } catch (err) {
        console.error("이메일 중복확인 통신 오류:", err);
        setEmailStatus({ checked: false, available: false, message: "서버 연결에 실패했습니다." });
      } finally {
        setIsCheckingEmail(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email, mode, registerStep]);

  useEffect(() => {
    if (agreeTerms && agreePrivacy && agreeMarketing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAgreeAll(true);
    } else {
      setAgreeAll(false);
    }
  }, [agreeTerms, agreePrivacy, agreeMarketing]);

  if (!isOpen) return null;

  const handleAgreeAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAgreeAll(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeMarketing(checked);
  };

  const handleNextStep = () => {
    if (!agreeTerms || !agreePrivacy) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }
    setError(null);
    setRegisterStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "register" && registerStep === 1) {
      handleNextStep();
      return;
    }

    if (mode === "register" && registerStep === 2) {
      if (!emailStatus.available) {
        setError(emailStatus.message || "이메일 중복 확인을 완료해 주세요.");
        return;
      }
      if (!passwordValidation.valid) {
        setError("비밀번호 유효성 조건(8자 이상, 영문, 숫자, 특수문자 !@#$%^&* 포함)을 충족해야 합니다.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const payload: UserRegister = { email, password, username };
        await postJson<UserResponse>("/api/v1/auth/register", payload);
        
        // On successful register, switch to login mode automatically
        switchMode("login");
        setError("회원가입이 완료되었습니다. 로그인해 주세요."); 
      } else {
        const payload: UserLogin = { email, password };
        const tokenData = await postJson<TokenResponse>("/api/v1/auth/login", payload);
        
        // Save token
        setAuthToken(tokenData.access_token);
        setRefreshToken(tokenData.refresh_token ?? null);

        let username = email.split("@")[0] ?? "user";
        let userId = 0;
        try {
          const base64Url = tokenData.access_token.split('.')[1] || "";
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const decoded = JSON.parse(jsonPayload);
          if (decoded.username) username = decoded.username;
          if (decoded.user_id) userId = decoded.user_id;
        } catch (e) {
          console.error("JWT decoding failed", e);
        }

        const authUser: UserResponse = {
          id: userId,
          email: email,
          username: username,
          is_active: true
        };
        setAuthUser(authUser);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("omnisite-auth-change"));
        }
        onSuccess(authUser);
        onClose();

      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError(null);
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setUsername("");
    setRegisterStep(1);
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setAgreeMarketing(false);
    setAgreeAll(false);
    setEmailStatus({ checked: false, available: false, message: "" });
    setPasswordValidation({ valid: false, message: "" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        
        <div className="flex border-b border-gray-200 shrink-0">
          <button 
            type="button"
            className={`flex-1 py-4 text-center font-bold transition-colors ${mode === "login" ? "bg-white text-primary border-b-2 border-primary" : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            onClick={() => switchMode("login")}
          >
            로그인
          </button>
          <button 
            type="button"
            className={`flex-1 py-4 text-center font-bold transition-colors ${mode === "register" ? "bg-white text-primary border-b-2 border-primary" : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            onClick={() => switchMode("register")}
          >
            회원가입
          </button>
        </div>

        <div className="overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className={`p-3 rounded-md text-sm font-medium ${error.includes("완료") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {error}
              </div>
            )}

            {/* Login Mode */}
            {mode === "login" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이메일</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="비밀번호 입력"
                  />
                </div>
              </>
            )}

            {/* Register Mode - Step 1: Terms */}
            {mode === "register" && registerStep === 1 && (
              <div className="space-y-5">
                <label className="flex items-center gap-2 text-base font-bold text-gray-900 pb-3 border-b border-gray-200 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                    checked={agreeAll} 
                    onChange={handleAgreeAll} 
                  />
                  서비스 약관에 모두 동의합니다.
                </label>

                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-[13px] leading-relaxed rounded-md">
                  - 필수 항목은 서비스 제공을 위해 필요한 항목이므로, 동의를 거부하시는 경우 서비스 이용에 제한이 있을 수 있습니다.
                </div>

                <div className="space-y-4 text-sm text-gray-700 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-gray-900">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={agreeTerms} 
                      onChange={(e) => setAgreeTerms(e.target.checked)} 
                    />
                    [필수] 이용약관 동의
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-gray-900">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          checked={agreePrivacy} 
                          onChange={(e) => setAgreePrivacy(e.target.checked)} 
                        />
                        [필수] 개인정보 수집 및 이용 동의
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showPrivacyDetails ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    </div>

                    {showPrivacyDetails && (
                      <div className="mt-2 border border-gray-200 rounded-md overflow-hidden text-[11px]">
                        <table className="w-full text-center bg-gray-50/50 divide-y divide-gray-200">
                          <thead>
                            <tr className="bg-gray-100 text-gray-600">
                              <th className="py-2 px-1 font-medium border-r border-gray-200">목적</th>
                              <th className="py-2 px-1 font-medium border-r border-gray-200">항목</th>
                              <th className="py-2 px-1 font-medium">보유기간</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="py-2 px-2 border-r border-gray-200">플랫폼 일반 회원가입 및 서비스 이용, 유지, 종료</td>
                              <td className="py-2 px-2 border-r border-gray-200">성명, 이메일(아이디), 비밀번호 등</td>
                              <td className="py-2 px-2">플랫폼 제공 서비스 이용기간 동안</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={agreeMarketing} 
                      onChange={(e) => setAgreeMarketing(e.target.checked)} 
                    />
                    [선택] 이벤트, 뉴스 정보 수신 동의
                  </label>
                </div>
              </div>
            )}

            {/* Register Mode - Step 2: User Info Input */}
            {mode === "register" && registerStep === 2 && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이메일(아이디)</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="user@example.com"
                  />
                  {/* 요구사항 2: 이메일 실시간 중복 체크 메세지 */}
                  <div className="min-h-[18px] text-[11px]">
                    {isCheckingEmail ? (
                      <span className="text-blue-500 animate-pulse">이메일 중복 확인 중...</span>
                    ) : (
                      <span className={emailStatus.available ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                        {emailStatus.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">이름</label>
                  <input 
                    type="text" 
                    required 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="홍길동"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="새 비밀번호"
                  />
                  {/* 요구사항 1: 비밀번호 유효성 메시지 및 특수문자 힌트 */}
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <span className={passwordValidation.valid ? "text-emerald-600 font-semibold text-[11px]" : "text-amber-600 text-[11px]"}>
                      {passwordValidation.message}
                    </span>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      * 8자 이상, 영문, 숫자, 특수문자(<code className="bg-gray-100 px-1 rounded text-gray-800">! @ # $ % ^ & *</code>) 조합 필수
                    </p>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-sm font-medium text-gray-700">비밀번호 확인</label>
                  <input 
                    type="password" 
                    required 
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="새 비밀번호 확인"
                  />
                  {passwordConfirm && password !== passwordConfirm && (
                    <span className="text-red-500 text-[11px]">❌ 비밀번호가 일치하지 않습니다.</span>
                  )}
                </div>
              </>
            )}

            <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 shrink-0">
              {mode === "register" && registerStep === 2 && (
                <button 
                  type="button" 
                  onClick={() => setRegisterStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 mr-auto"
                  disabled={loading}
                >
                  이전
                </button>
              )}
              
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={loading}
              >
                취소
              </button>
              
              <button 
                type="submit" 
                className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[120px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || (mode === "register" && registerStep === 1 && (!agreeTerms || !agreePrivacy))}
              >
                {loading ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  mode === "login" ? "로그인" : 
                  mode === "register" && registerStep === 1 ? "일반 회원가입" : "가입하기"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
