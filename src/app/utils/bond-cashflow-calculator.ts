import { BondModel } from '../bonds/model/bond.model';
import { CashflowModel } from '../bonds/model/cashflow.model';
import { BondMetricsCalculator } from './bond-metrics-calculator';

export class BondCashflowCalculator {

  public static calculateAmericanMethod(bond: BondModel): CashflowModel[] {
    const periodicRate = BondMetricsCalculator.convertToPeriodicRate(
      bond.interestRate,
      bond.rateType,
      bond.paymentFrequency,
      bond.compounding
    );

    const totalPeriods = BondMetricsCalculator.calculateTotalPeriodsFromDates(
      bond.issueDate,
      bond.maturityDate,
      bond.paymentFrequency
    );

    const amortizationPeriods = totalPeriods - bond.gracePeriod;

    const fixedInstallment = BondMetricsCalculator.calculateFixedInstallment(
      bond.faceValue,
      periodicRate,
      amortizationPeriods
    );

    return BondCashflowCalculator.generateCashFlowSchedule(
      bond,
      periodicRate,
      totalPeriods,
      amortizationPeriods,
      fixedInstallment
    );
  }

  private static generateCashFlowSchedule(
    bond: BondModel,
    periodicRate: number,
    totalPeriods: number,
    amortizationPeriods: number,
    fixedInstallment: number
  ): CashflowModel[] {
    const cashFlows: CashflowModel[] = [];
    let currentBalance = bond.faceValue;

    const totalExpenses = (bond.issuanceExpenses || 0) + (bond.placementExpenses || 0) +
      (bond.structuringExpenses || 0) + (bond.cavaliExpenses || 0);

    const totalExpensesInvestor = (bond.placementExpenses || 0) + (bond.cavaliExpenses || 0);

    var initialBalanceTrue = BondMetricsCalculator.round(currentBalance);
    var finalBalanceTrue = BondMetricsCalculator.round(currentBalance - totalExpenses);

    cashFlows.push({
      bondId: bond.id!,
      period: 0,
      date: bond.issueDate,
      initialBalance: initialBalanceTrue,
      interest: 0,
      amortization: 0,
      installment: 0,
      finalBalance: BondMetricsCalculator.round(currentBalance - totalExpenses),
      fixedInstallment: BondMetricsCalculator.round(bond.faceValue - totalExpenses),
      expenses: totalExpenses,
      investorFlow: BondMetricsCalculator.round(bond.faceValue - totalExpensesInvestor)
    });

    var initialInterest = 0;
    for (let period = 1; period <= totalPeriods; period++) {
      const periodInfo = BondMetricsCalculator.getPeriodType(period, bond.gracePeriod, bond.graceType);
      const date = BondMetricsCalculator.addPeriods(bond.issueDate, period, bond.paymentFrequency);
      const initialBalance = currentBalance;
      const interest = initialBalance * periodicRate;

      if (period === 1) {
        initialInterest = interest;
      }

      const { amortization, installment } = BondMetricsCalculator.calculatePeriodAmounts(
        periodInfo.type,
        interest,
        fixedInstallment,
        amortizationPeriods,
        currentBalance
      );

      currentBalance -= amortization;
      if (period === totalPeriods && currentBalance > 0 && currentBalance < 1) {
        currentBalance = 0;
      }

      if (period === totalPeriods) {
        // AL FINAL
        cashFlows.push({
          bondId: bond.id!,
          period,
          date,
          initialBalance: initialBalanceTrue,
          interest: BondMetricsCalculator.round(initialInterest),
          amortization: initialBalanceTrue,
          installment: BondMetricsCalculator.round(initialInterest + initialBalanceTrue),
          finalBalance: 0,
          fixedInstallment: BondMetricsCalculator.round(initialInterest + initialBalanceTrue),
          expenses: 0,
          investorFlow: BondMetricsCalculator.round(initialInterest + initialBalanceTrue)
        });
      }
      else {
        // LO DEMAS
        cashFlows.push({
          bondId: bond.id!,
          period,
          date,
          initialBalance: initialBalanceTrue,
          interest: BondMetricsCalculator.round(initialInterest),
          amortization: 0,
          installment: BondMetricsCalculator.round(initialInterest),
          finalBalance: finalBalanceTrue,
          fixedInstallment: BondMetricsCalculator.round(initialInterest),
          expenses: 0,
          investorFlow: 0
        });
      }
    }

    return cashFlows;
  }
}
