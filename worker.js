// [worker.js] 백그라운드 멀티스레딩 연산 엔진

// 1. Worker 내부에서 SheetJS 라이브러리 독립 로드
importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');

self.onmessage = function(e) {
    try {
        // 메인 스레드로부터 데이터 수신
        const { fileBuffer, branchArray, productObj } = e.data;
        const branchSet = new Set(branchArray); // O(1) 검색을 위해 배열을 다시 Set으로 변환

        // 2. 엑셀 파싱 (메인 스레드의 부하를 없애는 핵심 구간)
        const targetWb = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
        const targetData = XLSX.utils.sheet_to_json(targetWb.Sheets[targetWb.SheetNames[0]], {header: 1});

        let parsedData = [];
        let resultData = [targetData[0]]; // 엑셀 Export용 헤더 백업

        // 3. 수만 건 데이터 고속 매칭 및 추출 로직 (1-Pass)
        for(let r = 1; r < targetData.length; r++) {
            const row = targetData[r];
            if(!row || !row[3]) continue;
            
            const branchCode = String(row[3]).trim(); 
            
            if(branchSet.has(branchCode)) {
                resultData.push(row); // 엑셀 원시 데이터 보관
                
                let prodName = String(row[21] || "").trim();
                
                // 메모리에 올릴 핵심 경량화 데이터만 추출
                parsedData.push({
                    rawDate: String(row[0] || "").replace(/[^\d]/g, ""), 
                    mcp: Number(String(row[30] || "").replace(/[^\d\.-]/g, "")) || 0,
                    gName: productObj[prodName] || "기타",
                    agtId: String(row[5] || "").trim(),
                    agtDisplay: `[${String(row[1] || "").trim()}] ${String(row[2] || "").trim()} - ${String(row[4] || "").trim()}`,
                    yy: String(row[16] || "").replace(/[^\d]/g, ""),
                    gen: String(row[17] || "").trim(),
                    dxType: String(row[34] || "").trim()
                });
            }
        }

        // 4. 연산 결과를 메인 UI 스레드로 반환
        self.postMessage({ status: 'success', parsedData: parsedData, resultData: resultData });

    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
};