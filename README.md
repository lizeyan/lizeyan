---
layout: page
title: Zeyan Li
permalink: /
---

# Zeyan Li 李则言

**AI for Infrastructure · AIOps · Failure Diagnosis · Root Cause Analysis · Time Series Analysis**

[Google Scholar](https://scholar.google.com/citations?user=osylUIoAAAAJ&hl=en) ·
[GitHub](https://github.com/lizeyan) ·
[Personal Website](https://www.lizeyan.me) ·
Email: li_zeyan [at] icloud.com

---

## Articles

- [文章归档 / Article Archive](/articles/)  
  Browse Markdown articles with an automatically generated tree navigation. New Markdown files committed under `articles/` will appear in the archive.

### 精选文章

{% assign featured_articles = site.pages | where: "featured", true | sort: "featured_order" %}
{% for article in featured_articles %}
- [{{ article.title }}](/articles/#{{ article.path }})
{% endfor %}

---

## Bio

I am currently an R&D engineer at ByteDance, working on **AI for Infrastructure** and **AIOps**. My work focuses on intelligent alerting, log intelligence, failure diagnosis, root cause analysis, and large-model-based agents for production infrastructure systems.

I received my Ph.D. in Computer Science from **Tsinghua University** in 2023, advised by Prof. Dan Pei. My doctoral research focused on AIOps, failure management, anomaly detection, and root cause analysis for large-scale online service systems.

Before my Ph.D. study, I received my Bachelor's degree in Computer Science from **Tsinghua University** in 2018.

My research has been published in conferences and journals including **ESEC/FSE**, **WWW**, **KDD**, **ISSRE**, **INFOCOM**, **SIGMOD Conference Companion**, **PVLDB**, and **ICSE**.

---

我目前任职于**字节跳动**，从事 **AI for Infrastructure** 与 **AIOps** 相关研发工作，主要关注智能告警、日志智能化、故障诊断、根因定位，以及面向生产系统的大模型 Agent。

我于 2023 年获得**清华大学计算机科学与技术博士学位**，导师为裴丹教授。博士期间的研究方向包括 AIOps、故障管理、异常检测以及大规模在线服务系统中的根因分析。

在攻读博士学位之前，我于 2018 年获得**清华大学计算机科学与技术学士学位**。

我的研究成果发表于 **ESEC/FSE**、**WWW**、**KDD**、**ISSRE**、**INFOCOM**、**SIGMOD**、**PVLDB** 和 **ICSE** 等会议与期刊。

---

## 研究方向

- 智能运维与 AI for Infrastructure
- 故障诊断与根因定位
- 时间序列与日志异常检测
- 智能告警与事件管理
- 日志解析与日志智能化
- 大模型 Agent

---

## 工作经历

### 字节跳动  
**算法工程师，AI for Infrastructure / AIOps**  
*2023 年 6 月至今*

从事面向大规模生产基础设施系统的 AIOps 算法研发与工程落地。近期工作覆盖智能告警、日志解析、自动化故障诊断，以及大模型 Agent 在基础设施运维场景中的应用。

代表性方向包括：

- 面向大规模指标监控的智能告警
- 面向云服务的高效自适应日志解析
- 面向生产事故的自动化诊断 Agent
- 面向 AIOps 场景的时间序列与多模态基础模型

### BizSeer  
**算法工程师实习生**  
*2019 年 1 月 – 2022 年 6 月*

参与银行信息系统中的根因服务定位与故障诊断相关研究和系统建设。

---

## 教育背景

### 清华大学  
**计算机科学与技术博士**  
*2018 年 8 月 – 2023 年 6 月*

导师：裴丹教授  
研究方向：智能运维、故障诊断、根因定位、异常检测

### 清华大学  
**计算机科学与技术学士**  
*2014 年 8 月 – 2018 年 7 月*

---

## 论文发表

### 一作论文

1. **Zeyan Li**, Jing Han, Nengwen Zhao, Shenglin Zhang, Yongqian Sun, Pengfei Chen, Xidao Wen, Minghua Ma, and Dan Pei.<br>
   *Constructing Large-Scale Real-World Benchmark Datasets for AIOps.*<br>
   **ZTE Communications**, 24(3):59–69, 2026. [DOI](https://doi.org/10.12142/ZTECOM.202603008)

2. **Zeyan Li**, Jie Song, Tieying Zhang, Tao Yang, Xiongjun Ou, Yingjie Ye, Pengfei Duan, Muchen Lin, and Jianjun Chen.<br>
   *Adaptive and Efficient Log Parsing as a Cloud Service.*  
   **SIGMOD Conference Companion**, 2025.

3. **Zeyan Li**, Nengwen Zhao, Mingjie Li, Xianglin Lu, Lixin Wang, Dongdong Chang, Xiaohui Nie, Li Cao, Wenchi Zhang, Kaixin Sui, Yanhua Wang, Xu Du, Guoqiang Duan, and Dan Pei.<br>
   *Actionable and Interpretable Fault Localization for Recurring Failures in Online Service Systems.*  
   **ESEC/FSE**, 2022.

4. **Zeyan Li**, Junjie Chen, Rui Jiao, Nengwen Zhao, Zhijun Wang, Shuwei Zhang, Yanjun Wu, Long Jiang, Leiqin Yan, Zikai Wang, Zhekang Chen, Wenchi Zhang, Xiaohui Nie, Kaixin Sui, and Dan Pei.<br>
   *Practical Root Cause Localization for Microservice Systems via Trace Analysis.*  
   **IWQoS**, 2021.

5. **Zeyan Li**, Chengyang Luo, Yiwei Zhao, Yongqian Sun, Kaixin Sui, Xiping Wang, Dapeng Liu, Xing Jin, Qi Wang, and Dan Pei.<br>
   *Generic and Robust Localization of Multi-dimensional Root Causes.*  
   **ISSRE**, 2019.

6. **Zeyan Li**, Wenxiao Chen, and Dan Pei.<br>
   *Robust and Unsupervised KPI Anomaly Detection Based on Conditional Variational Autoencoder.*  
   **IPCCC**, 2018.

---

### 指导实习生

- Zhe Xie, **Zeyan Li**, Xiao He, Shenglin Zhang, Longlong Xu, Yuzhuo Yang, Tieying Zhang, Jianjun Chen, Rui Shi, and Dan Pei.  
   *FoundRoot: Towards Foundation Model for Root Cause Analysis via Structured Deep Thinking.*  
   **ICSE**, 2026.

- Zhe Xie, **Zeyan Li**, Xiao He, Longlong Xu, Xidao Wen, Tieying Zhang, Jianjun Chen, Rui Shi, and Dan Pei.  
   *ChatTS: Aligning Time Series with LLMs via Synthetic Data for Enhanced Understanding and Reasoning.*  
   **Proceedings of the VLDB Endowment**, 2025.

- Changhua Pei, Zexin Wang, Fengrui Liu, **Zeyan Li**, Yang Liu, Xiao He, Rong Kang, Tieying Zhang, Jianjun Chen, Jianhui Li, Gaogang Xie, and Dan Pei.  
   *Flow-of-Action: SOP Enhanced LLM-Based Multi-Agent System for Root Cause Analysis.*  
   **WWW Companion**, 2025.

---

### 其他代表性合著论文

1. Longlong Xu, **Zeyan Li**, Xiao He, Zhaoyang Yu, Changhua Pei, Zhe Xie, Zijun Dou, Tieying Zhang, and Dan Pei.<br>
   *Taming the Recent-Data Bias: Towards Robust Time Series Forecasting with Global Context.*<br>
   **ICML**, 2026. [Paper](https://proceedings.mlr.press/v306/xu26ab.html)

2. Longlong Xu, **Zeyan Li**, Xiao He, Zhaoyang Yu, Dazhong Wen, Mingze Sun, Changhua Pei, and Dan Pei.<br>
   *See More, Forecast Better and Faster: Enhancing Time Series Foundation Models via Inference-Time Plug-and-Play Downsampling.*<br>
   **ICML**, 2026. [Paper](https://proceedings.mlr.press/v306/xu26ac.html)

3. Mingjie Li, **Zeyan Li**, Kanglin Yin, Xiaohui Nie, Wenchi Zhang, Kaixin Sui, and Dan Pei.<br>
   *Causal Inference-Based Root Cause Analysis for Online Service Systems with Intervention Recognition.*  
   **KDD**, 2022.

4. Nengwen Zhao, Honglin Wang, **Zeyan Li**, Xiao Peng, Gang Wang, Zhu Pan, Yong Wu, Zhen Feng, Xidao Wen, Wenchi Zhang, Kaixin Sui, and Dan Pei.<br>
   *An Empirical Investigation of Practical Log Anomaly Detection for Online Service Systems.*  
   **ESEC/FSE**, 2021.

5. Qingyang Yu, Nengwen Zhao, Mingjie Li, **Zeyan Li**, Honglin Wang, Wenchi Zhang, Kaixin Sui, and Dan Pei.<br>
   *A Survey on Intelligent Management of Alerts and Incidents in IT Services.*  
   **Journal of Network and Computer Applications**, 2024.

6. Zhenhe Yao, Haowei Ye, Changhua Pei, Guang Cheng, Guangpei Wang, Zhiwei Liu, Hongwei Chen, Hang Cui, **Zeyan Li**, Jianhui Li, and Gaogang Xie.<br>
   *SparseRCA: Unsupervised Root Cause Analysis in Sparse Microservice Testing Traces.*  
   **ISSRE**, 2024.

7. Haowen Xu, Wenxiao Chen, Nengwen Zhao, **Zeyan Li**, Jiahao Bu, Zhihan Li, Ying Liu, Youjian Zhao, Dan Pei, Yang Feng, Jie Chen, Zhaogang Wang, and Honglin Qiao.<br>
   *Unsupervised Anomaly Detection via Variational Auto-Encoder for Seasonal KPIs in Web Applications.*  
   **WWW**, 2018.

8. Xianglin Lu, Zhe Xie, **Zeyan Li**, Mingjie Li, Xiaohui Nie, Nengwen Zhao, Qingyang Yu, Shenglin Zhang, Kaixin Sui, Lin Zhu, and Dan Pei.<br>
   *Generic and Robust Performance Diagnosis via Causal Inference for OLTP Database Systems.*  
   **CCGrid**, 2022.

9. Ruming Tang, Zheng Yang, **Zeyan Li**, Weibin Meng, Haixin Wang, Qi Li, Yongqian Sun, Dan Pei, Tao Wei, Yanfei Xu, and Yan Liu.<br>
   *ZeroWall: Detecting Zero-Day Web Attacks through Encoder-Decoder Recurrent Neural Networks.*  
   **INFOCOM**, 2020.

10. Wenxiao Chen, Haowen Xu, **Zeyan Li**, Dan Pei, Jie Chen, Honglin Qiao, Yang Feng, and Zhaogang Wang.<br>
   *Unsupervised Anomaly Detection for Intricate KPIs via Adversarial Training of VAE.*  
   **INFOCOM**, 2019.

---

## 专利

- CN202110622067. 裴丹，李则言。  
  *调用链异常检测方法、计算机设备以及可读存储介质。*

- CN202110319752. 裴丹，李则言。  
  *基于条件变分自动编码器的 KPI 异常检测方法和装置。*

- CN202010727337. 李则言，张文池，程博，黄成，陈哲康，沈梦家，隋楷心，刘大鹏。  
  *一种故障定位方法、装置、电子设备及存储介质。*

---

## 荣誉奖励

- 字节跳动基础架构年度“创新突破奖”，2024
- 清华大学计算机系优秀毕业生，2023
- 清华大学计算机系优秀毕业生，2018

---

## 学术服务

- Reviewer, AAAI 2025
- Reviewer, TNSM
- Reviewer, ICDE 2024
- Reviewer, AAAI 2024
- Reviewer, AAAI 2023
